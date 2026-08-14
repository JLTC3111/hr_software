/**
 * Notifications — the inbox as a ledger, not a stack of coloured cards.
 *
 * The read, top to bottom:
 *   ticker  — total, unread, errors, warnings. The four figures that used to be
 *             stat cards below the title; they belong on the strip with every
 *             other screen's figures.
 *   head    — what you are looking at, plus the status seg and the bulk actions.
 *   ledger  — one blueprint, one hairline rule per row. Unread carries a 3px
 *             accent edge and a wash; type reads through a Tag, never through a
 *             red or green card background.
 *   rail    — the unread figure, then the same inbox counted by category and by
 *             type, both derived from the notification list rather than typed.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius 0, cards are
 * outlines with four registration corners, status reads through weight and rule.
 */
import _React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCheck, Filter, AlertCircle, Trash2, Trash, Info, CheckCircle, AlertTriangle, Inbox, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
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
import {
  localizeSystemNotificationActionLabel,
  localizeSystemNotificationMessage,
  localizeSystemNotificationTitle,
} from '../utils/notificationTranslation';
import { ShinyButton } from './ui/shiny-button';
import { SlidingNumber } from './motion-primitives';
import { getIndustry, DISPLAY, BODY, figure, rampAt } from '../theme/industry.js';
import { Blueprint, Bar, Tag, Btn, Seg, Kicker, ColumnHeading, TickerCell, LiveClock, FlatSelect } from './ui/industry.jsx';
import { FetchElapsedPill } from './ui/fetch-elapsed-pill';

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

/**
 * Severity through weight and rule. An error is an outline — the loudest thing
 * the system has — a success is filled accent, and everything else stays quiet.
 */
const TYPE_VARIANT = {
  error: 'outline',
  warning: 'outline',
  success: 'accent',
  info: 'neutral',
};

/** Tally one field of the notification list, biggest bucket first. */
const countBy = (notifications, key) => {
  const counts = new Map();
  notifications.forEach((n) => {
    const value = n[key] || (key === 'type' ? 'info' : 'general');
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
};

const Notifications = () => {
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
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
    markManyAsRead,
    checkPendingApprovals
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

  // Reconcile pending-approval notice whenever the page is opened
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof checkPendingApprovals === 'function') {
        await checkPendingApprovals();
      }
      if (!cancelled && typeof refreshNotificationData === 'function') {
        await refreshNotificationData();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkPendingApprovals, refreshNotificationData]);

  const clearFilters = () => {
    setFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (typeof checkPendingApprovals === 'function') {
        await checkPendingApprovals();
      }
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
    const props = { size: 15, strokeWidth: 1.5, style: { color: ind.inkMuted, flex: 'none' } };
    switch (type) {
      case 'success':
        return <CheckCircle {...props} />;
      case 'error':
        return <AlertCircle {...props} style={{ ...props.style, color: ind.ink }} />;
      case 'warning':
        return <AlertTriangle {...props} style={{ ...props.style, color: ind.ink }} />;
      default:
        return <Info {...props} />;
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

  const getTranslatedType = (type) => {
    const typeMap = {
      info: t('notifications.info', 'Info'),
      success: t('notifications.success', 'Success'),
      warning: t('notifications.warning', 'Warning'),
      error: t('notifications.error', 'Error'),
    };
    return typeMap[type] || type || t('notifications.info', 'Info');
  };

  const getNotificationTitleText = (notification) => {
    const demoTitle = getDemoNotificationTitle(notification, t);
    if (demoTitle && demoTitle !== notification.title) {
      return demoTitle;
    }
    return localizeSystemNotificationTitle(notification.title, t);
  };

  const getNotificationMessageText = (notification) => {
    const demoMessage = getDemoNotificationMessage(notification, t);
    if (demoMessage && demoMessage !== notification.message) {
      return demoMessage;
    }
    return localizeSystemNotificationMessage(notification.message, t);
  };

  const getNotificationActionLabelText = (notification) => {
    const demoLabel = getDemoNotificationActionLabel(notification, t);
    if (demoLabel && demoLabel !== notification.action_label) {
      return demoLabel;
    }
    return localizeSystemNotificationActionLabel(notification.action_label, t);
  };

  /**
   * The rail's two breakdowns. Counted off the same list the ledger renders, so
   * the shares cannot disagree with the rows.
   */
  const byCategory = useMemo(() => countBy(notifications, 'category'), [notifications]);
  const byType = useMemo(() => countBy(notifications, 'type'), [notifications]);
  const railTotal = notifications.length || 1;

  /* ---------------- shared chrome ---------------- */

  const caption = { fontFamily: BODY, fontSize: 13, color: ind.inkMuted, lineHeight: 1.5, margin: 0 };
  const columnNote = { fontFamily: BODY, fontSize: 11.5, color: ind.inkMuted, lineHeight: 1.45, margin: '6px 0 0' };
  const fieldLabelStyle = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 4,
  };
  const iconBtnStyle = {
    width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${ind.hairline}`, background: 'transparent', color: ind.ink,
    borderRadius: 0, cursor: 'pointer', padding: 0, flex: 'none',
  };

  const frameStyle = {
    border: `1px solid ${ind.hairline}`,
    background: ind.ground,
    color: ind.ink,
    fontFamily: BODY,
    fontSize: 14,
    borderRadius: 0,
  };

  const ticker = (
    <div
      style={{
        height: 44, background: ind.tickerBg, color: ind.tickerInk,
        borderBottom: `1px solid ${ind.hairline}`,
        display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden',
      }}
    >
      <TickerCell ind={ind}>
        <LiveClock ind={ind} live={notifications.length > 0} />
      </TickerCell>
      <TickerCell ind={ind} label={t('notifications.total', 'Total')} value={stats?.total_notifications ?? notifications.length} />
      <TickerCell
        ind={ind}
        label={t('notifications.unread', 'Unread')}
        value={stats?.unread_count ?? unreadCount}
        // The one figure on the strip that asks somebody to act.
        valueColor={(stats?.unread_count ?? unreadCount) > 0 ? ind.tickerUp : undefined}
      />
      <TickerCell ind={ind} label={t('notifications.errors', 'Errors')} value={stats?.error_count ?? 0} />
      <TickerCell ind={ind} label={t('notifications.warnings', 'Warnings')} value={stats?.warning_count ?? 0} />
      <TickerCell ind={ind} label={t('notifications.shown', 'Shown')} value={filteredNotifications.length} />

      <div
        style={{
          flex: 1, minWidth: 'max-content', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: 8, padding: '0 14px',
          borderLeft: `1px solid ${ind.tickerRule}`,
        }}
      >
        <FetchElapsedPill active={loading || isRefreshing || loadingMore} isDarkMode label={t('common.fetching', 'Fetching')} />
        <FlatSelect
          ind={ind}
          onDark
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={t('notifications.category', 'Category')}
          style={{ maxWidth: 200 }}
        >
          <option value="all" style={{ color: '#1d1f20' }}>{t('notifications.allCategories', 'All Categories')}</option>
          <option value="general" style={{ color: '#1d1f20' }}>{t('notifications.general', 'General')}</option>
          <option value="time_tracking" style={{ color: '#1d1f20' }}>{t('notifications.timeTracking', 'Time Tracking')}</option>
          <option value="performance" style={{ color: '#1d1f20' }}>{t('notifications.performance', 'Performance')}</option>
          <option value="employee" style={{ color: '#1d1f20' }}>{t('notifications.employee', 'Employee')}</option>
          <option value="recruitment" style={{ color: '#1d1f20' }}>{t('notifications.recruitment', 'Recruitment')}</option>
          <option value="system" style={{ color: '#1d1f20' }}>{t('notifications.system', 'System')}</option>
        </FlatSelect>
      </div>
    </div>
  );

  if (loading && notifications.length === 0) {
    return (
      <div data-screen-label="Notifications" style={frameStyle}>
        {ticker}
        <div style={{ padding: '64px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', color: ind.inkMuted }}>
            {t('common.loading', 'Loading')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div data-screen-label="Notifications" style={frameStyle}>
      {ticker}

      {/* ── BANDS ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch">

        {/* ── LEFT — the ledger. min-w-0 or long messages win. ───── */}
        <div
          className="flex-1 min-w-0 flex flex-col"
          style={{ padding: '22px 24px 20px', gap: 16, borderRight: `1px solid ${ind.hairline}` }}
        >
          {/* ── PAGE HEAD ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: BODY, fontSize: 32, fontWeight: 400, margin: 0, color: ind.ink, lineHeight: 1.1 }}>
                {t('notifications.title', 'Notifications')}
              </h1>
              <p style={{ ...caption, marginTop: 6 }}>
                {[
                  t('notifications.nShownOf', '{shown} of {total} shown')
                    .replace('{shown}', String(filteredNotifications.length))
                    .replace('{total}', String(notifications.length)),
                  t('notifications.unreadCount', '{0} unread').replace('{0}', String(unreadCount)),
                ].join(' · ')}
              </p>
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
              <Seg
                ind={ind}
                ariaLabel={t('notifications.status', 'Status')}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('notifications.allNotifications', 'All') },
                  { value: 'unread', label: t('notifications.unreadOnly', 'Unread') },
                  { value: 'read', label: t('notifications.readOnly', 'Read') },
                ]}
              />

              <Btn
                ind={ind}
                onClick={handleRefresh}
                disabled={isRefreshing || isBulkActionRunning}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : undefined} />
                {t('notifications.refresh', 'Refresh')}
              </Btn>

              <Btn
                ind={ind}
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: showFilters ? ind.accentWash : 'transparent',
                }}
              >
                <Filter size={13} strokeWidth={1.5} />
                {t('notifications.filters', 'Filters')}
              </Btn>

              {unreadCount > 0 && (
                /* Kept as a ShinyButton — the sweep is what marks the two bulk
                   actions apart from the per-row ones. Re-skinned, not stripped. */
                <ShinyButton
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={isBulkActionRunning}
                  shineOnHover
                  className="rounded-none border px-3 py-1"
                  title={t('notifications.markAllRead', 'Mark all as read')}
                  style={{
                    borderRadius: 0, background: ind.accent, color: ind.accentInk,
                    borderColor: ind.accent, opacity: isBulkActionRunning ? 0.5 : 1,
                  }}
                >
                  <CheckCheck size={13} strokeWidth={1.5} />
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    {t('notifications.markAllRead', 'Mark all as read')}
                  </span>
                </ShinyButton>
              )}

              {notifications.length > 0 && (
                <ShinyButton
                  type="button"
                  onMouseEnter={() => setIsHoveringDeleteAll(true)}
                  onMouseLeave={() => setIsHoveringDeleteAll(false)}
                  onClick={handleDeleteAll}
                  disabled={isBulkActionRunning}
                  shineOnHover
                  className="rounded-none border px-3 py-1"
                  title={t('notifications.deleteAll', 'Delete all')}
                  style={{
                    borderRadius: 0, background: 'transparent', color: ind.ink,
                    borderColor: ind.ink, opacity: isBulkActionRunning ? 0.5 : 1,
                  }}
                >
                  {isHoveringDeleteAll
                    ? <MiniFlubberAutoMorphDelete size={14} isDarkMode={isDarkMode} />
                    : <Trash2 size={13} strokeWidth={1.5} />}
                  <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    {t('notifications.deleteAll', 'Delete all')}
                  </span>
                </ShinyButton>
              )}
            </div>
          </div>

          {/* ── FILTER STRIP ──────────────────────────────────────── */}
          {showFilters && (
            <div
              className="flex flex-wrap items-end"
              style={{ gap: 14, padding: '12px 14px', border: `1px solid ${ind.hairline}` }}
            >
              <div style={{ minWidth: 160 }}>
                <label htmlFor="notif-type-filter" style={fieldLabelStyle}>
                  {t('notifications.type', 'Type')}
                </label>
                <FlatSelect
                  ind={ind}
                  id="notif-type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">{t('notifications.allTypes', 'All Types')}</option>
                  <option value="info">{t('notifications.info', 'Info')}</option>
                  <option value="success">{t('notifications.success', 'Success')}</option>
                  <option value="warning">{t('notifications.warning', 'Warning')}</option>
                  <option value="error">{t('notifications.error', 'Error')}</option>
                </FlatSelect>
              </div>

              <div style={{ minWidth: 180 }}>
                <label htmlFor="notif-category-filter" style={fieldLabelStyle}>
                  {t('notifications.category', 'Category')}
                </label>
                <FlatSelect
                  ind={ind}
                  id="notif-category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">{t('notifications.allCategories', 'All Categories')}</option>
                  <option value="general">{t('notifications.general', 'General')}</option>
                  <option value="time_tracking">{t('notifications.timeTracking', 'Time Tracking')}</option>
                  <option value="performance">{t('notifications.performance', 'Performance')}</option>
                  <option value="employee">{t('notifications.employee', 'Employee')}</option>
                  <option value="recruitment">{t('notifications.recruitment', 'Recruitment')}</option>
                  <option value="system">{t('notifications.system', 'System')}</option>
                </FlatSelect>
              </div>

              <div style={{ flex: 1 }} />

              {hasActiveFilters && (
                <Btn ind={ind} onClick={clearFilters}>
                  {t('notifications.clearFilters', 'Clear filters')}
                </Btn>
              )}
            </div>
          )}

          {/* ── LEDGER ────────────────────────────────────────────── */}
          {filteredNotifications.length === 0 ? (
            <Blueprint ind={ind} style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Inbox size={28} strokeWidth={1.25} style={{ color: ind.inkFaint, margin: '0 auto' }} />
              <div style={{ marginTop: 12 }}>
                <ColumnHeading ind={ind}>{t('notifications.noNotifications', 'No notifications')}</ColumnHeading>
              </div>
              <p style={{ ...caption, marginTop: 6 }}>
                {hasActiveFilters || notifications.length > 0
                  ? t('notifications.noNotificationsFilter', 'No notifications match your filters')
                  : t('notifications.noNotificationsYet', 'You don\'t have any notifications yet')}
              </p>
              {hasActiveFilters && (
                <Btn ind={ind} onClick={clearFilters} style={{ marginTop: 14 }}>
                  {t('notifications.clearFilters', 'Clear filters')}
                </Btn>
              )}
            </Blueprint>
          ) : (
            <Blueprint ind={ind} style={{ padding: '4px 0 0' }}>
              {filteredNotifications.map((notification, index) => {
                const unread = !notification.is_read;
                const busy = updatingNotifications.has(notification.id);
                const actionable = !!notification.action_url;
                return (
                  <div
                    key={notification.id}
                    role={actionable ? 'button' : undefined}
                    tabIndex={actionable ? 0 : undefined}
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(e) => {
                      if (actionable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '12px 16px 12px 13px',
                      borderTop: index === 0 ? 'none' : `1px solid ${ind.rule}`,
                      // The unread mark is an edge and a wash, never a coloured card.
                      borderLeft: `3px solid ${unread ? ind.accent : 'transparent'}`,
                      background: unread ? ind.accentWash : 'transparent',
                      cursor: actionable ? 'pointer' : 'default',
                      opacity: busy ? 0.5 : 1,
                      pointerEvents: busy ? 'none' : undefined,
                      transition: 'background .15s ease',
                    }}
                  >
                    <span style={{ marginTop: 2, flex: 'none' }}>
                      {busy
                        ? <Loader2 size={15} strokeWidth={1.5} className="animate-spin" style={{ color: ind.inkMuted }} />
                        : getTypeIcon(notification.type)}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                        <span style={{ fontFamily: BODY, fontSize: 14, color: ind.ink, minWidth: 0 }}>
                          {getNotificationTitleText(notification)}
                        </span>
                        <Tag ind={ind} variant={TYPE_VARIANT[notification.type] || 'neutral'}>
                          {getTranslatedType(notification.type)}
                        </Tag>
                        {unread && (
                          <span aria-hidden="true" style={{ width: 6, height: 6, background: ind.accent, flex: 'none' }} />
                        )}
                      </div>

                      <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted, margin: '4px 0 0', lineHeight: 1.5 }}>
                        {getNotificationMessageText(notification)}
                      </p>

                      {notification.action_url && notification.action_label && (
                        <span
                          className="inline-flex items-center"
                          style={{
                            gap: 5, marginTop: 6,
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 11.5, letterSpacing: '.08em',
                            textTransform: 'uppercase', color: ind.accentDeep,
                          }}
                        >
                          {getNotificationActionLabelText(notification)}
                          <ExternalLink size={11} strokeWidth={1.5} />
                        </span>
                      )}

                      <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 7 }}>
                        <span
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.1em',
                            textTransform: 'uppercase', color: ind.inkFaint, fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatTime(notification.created_at)}
                        </span>
                        <span
                          style={{
                            fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, letterSpacing: '.1em',
                            textTransform: 'uppercase', color: ind.inkFaint,
                          }}
                        >
                          {getTranslatedCategory(notification.category)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center" style={{ gap: 6, flex: 'none' }}>
                      {unread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(e, notification.id)}
                          title={t('notifications.markAsRead', 'Mark as read')}
                          aria-label={t('notifications.markAsRead', 'Mark as read')}
                          style={iconBtnStyle}
                        >
                          <CheckCheck size={12} strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, notification.id)}
                        title={t('notifications.delete', 'Delete')}
                        aria-label={t('notifications.delete', 'Delete')}
                        style={iconBtnStyle}
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Ledger foot — the range, and the way to extend it. */}
              <div
                className="flex flex-wrap items-center justify-between"
                style={{ gap: 10, padding: '10px 16px', borderTop: `1px solid ${ind.hairline}` }}
              >
                <span style={{ fontFamily: BODY, fontSize: 11.5, color: ind.inkFaint }}>
                  {t('notifications.nShownOf', '{shown} of {total} shown')
                    .replace('{shown}', String(filteredNotifications.length))
                    .replace('{total}', String(notifications.length))}
                </span>
                {hasMoreNotifications && (
                  <Btn ind={ind} onClick={loadMoreNotifications} disabled={loadingMore}>
                    {loadingMore
                      ? t('notifications.loadingMore', 'Loading...')
                      : t('notifications.loadMore', 'Load more')}
                  </Btn>
                )}
              </div>
            </Blueprint>
          )}
        </div>

        {/* ── RIGHT — the same inbox, counted, 340px ─────────────── */}
        <aside
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col"
          style={{ background: ind.chrome, overflow: 'hidden' }}
        >
          <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${ind.hairline}` }}>
            <Kicker ind={ind}>{t('notifications.unread', 'Unread')}</Kicker>
            <div className="flex items-baseline" style={{ gap: 8, margin: '4px 0 0' }}>
              {/* SlidingNumber kept from the old stat cards — the one figure on
                  this screen that is worth watching move. */}
              <span style={{ ...figure(52, ind.ink), lineHeight: 0.92 }}>
                <SlidingNumber value={Number(unreadCount) || 0} />
              </span>
              <span style={{ fontFamily: BODY, fontSize: 12, color: ind.inkMuted }}>
                {t('notifications.ofN', 'of {n}').replace('{n}', String(notifications.length))}
              </span>
            </div>
            <p style={columnNote}>
              {unreadCount > 0
                ? t('notifications.leavingMarksRead', 'Leaving this screen marks everything shown as read.')
                : t('notifications.allCaughtUp', "You're all caught up!")}
            </p>
          </div>

          <div style={{ padding: '18px 20px 12px', borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('notifications.byCategory', 'By category')}</ColumnHeading>
          </div>
          {byCategory.length === 0 ? (
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ind.rule}` }}>
              <p style={{ fontFamily: BODY, fontSize: 12.5, color: ind.inkMuted }}>—</p>
            </div>
          ) : byCategory.map((row, i) => (
            <button
              key={row.value}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === row.value ? 'all' : row.value)}
              className="w-full text-left"
              style={{
                padding: '11px 20px',
                background: categoryFilter === row.value ? ind.accentWash : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${ind.rule}`,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'background .15s ease',
              }}
            >
              <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
                <span
                  style={{
                    fontFamily: BODY, fontSize: 12.5, color: ind.ink, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {getTranslatedCategory(row.value)}
                </span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {row.count}
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar ind={ind} value={row.count / railTotal} fill={rampAt(ind, i)} height={6} />
              </div>
            </button>
          ))}

          <div style={{ padding: '18px 20px 12px', marginTop: 6, borderBottom: `1px solid ${ind.hairline}` }}>
            <ColumnHeading ind={ind}>{t('notifications.byType', 'By type')}</ColumnHeading>
          </div>
          {byType.map((row) => (
            <div
              key={row.value}
              className="flex items-center justify-between"
              style={{ gap: 12, padding: '10px 20px', borderBottom: `1px solid ${ind.rule}` }}
            >
              <Tag ind={ind} variant={TYPE_VARIANT[row.value] || 'neutral'}>
                {getTranslatedType(row.value)}
              </Tag>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: ind.ink, fontVariantNumeric: 'tabular-nums' }}>
                {row.count}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
};

export default Notifications;
