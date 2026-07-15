import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { useLanguage } from './LanguageContext.jsx';
import { ensureValidSession } from '../hooks/useSessionGuard.js';
import { supabase } from '../config/supabaseClient.js';
import { isDemoMode } from '../utils/demoHelper.js';
import { getRealtimeEventType } from '../utils/realtimeHelpers.js';
import { playNotificationSound } from '../utils/notificationSound.js';
import * as notificationService from '../services/notificationService.js';
import * as settingsService from '../services/settingsService.js';

const NotificationContext = createContext();

const DEMO_TIME_ENTRIES_KEY = 'hr_app_demo_time_entries';
const NOTIFICATIONS_PAGE_SIZE = 20;

const EMPTY_STATS = {
  total_notifications: 0,
  unread_count: 0,
  error_count: 0,
  warning_count: 0,
  latest_notification_at: null
};

export const NOTIFICATION_PREFS_CHANGED_EVENT = 'notification-prefs-changed';

const NOTIFICATION_PREF_KEYS = [
  'push_notifications',
  'desktop_notifications',
  'notification_sound',
  'notification_frequency',
  'notify_time_tracking',
  'notify_performance',
  'notify_employee_updates',
  'notify_recruitment',
  'notify_system'
];

const DEFAULT_NOTIFICATION_PREFS = {
  push_notifications: true,
  desktop_notifications: false,
  notification_sound: false,
  notification_frequency: 'realtime',
  notify_time_tracking: true,
  notify_performance: true,
  notify_employee_updates: true,
  notify_recruitment: true,
  notify_system: true
};

const pickNotificationPrefs = (settings) => {
  if (!settings) return { ...DEFAULT_NOTIFICATION_PREFS };

  const picked = { ...DEFAULT_NOTIFICATION_PREFS };
  NOTIFICATION_PREF_KEYS.forEach((key) => {
    if (settings[key] !== undefined) {
      picked[key] = settings[key];
    }
  });
  return picked;
};

const applyNotificationPrefs = (setPrefs, ref, prefs) => {
  setPrefs(prefs);
  ref.current = prefs;
};

const CATEGORY_PREF_KEYS = {
  time_tracking: 'notify_time_tracking',
  performance: 'notify_performance',
  employee: 'notify_employee_updates',
  recruitment: 'notify_recruitment',
  system: 'notify_system',
  general: 'notify_system'
};

const isCategoryEnabled = (prefs, category) => {
  const key = CATEGORY_PREF_KEYS[category] || 'notify_system';
  return prefs[key] !== false;
};

const shouldDeliverBrowserNotification = (prefs, notification) => {
  if (!notification || notification.is_read) return false;
  if (prefs.notification_frequency && prefs.notification_frequency !== 'realtime') {
    return false;
  }
  if (!isCategoryEnabled(prefs, notification.category)) return false;
  return Boolean(prefs.push_notifications || prefs.desktop_notifications);
};

const shouldPlayNotificationSound = (prefs, notification) => {
  if (!notification || notification.is_read) return false;
  if (!prefs.notification_sound || !prefs.push_notifications) return false;
  if (prefs.notification_frequency && prefs.notification_frequency !== 'realtime') {
    return false;
  }
  return isCategoryEnabled(prefs, notification.category);
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const NotificationToast = ({ toast, onDismiss }) => {
  if (!toast.show) return null;

  const isError = toast.type === 'error';

  return (
    <div
      className={`fixed bottom-6 right-6 z-9999 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border max-w-sm ${
        isError
          ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-100'
          : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-100'
      }`}
      role="status"
    >
      {isError ? (
        <AlertCircle className="h-5 w-5 shrink-0" />
      ) : (
        <CheckCircle className="h-5 w-5 shrink-0" />
      )}
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded hover:opacity-70 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated, handleSessionAuthError } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const pendingApprovalsDebounceRef = useRef(null);
  const pendingApprovalsCheckRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const notificationPrefsRef = useRef(DEFAULT_NOTIFICATION_PREFS);
  const loadedOffsetRef = useRef(0);

  const unreadCount = stats.unread_count;

  useEffect(() => {
    notificationPrefsRef.current = notificationPrefs;
  }, [notificationPrefs]);

  const showActionError = useCallback((message) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ show: true, message, type: 'error' });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const updateNotificationPrefs = useCallback((settings) => {
    const picked = pickNotificationPrefs(settings);
    applyNotificationPrefs(setNotificationPrefs, notificationPrefsRef, picked);
    return picked;
  }, []);

  const loadNotificationPrefs = useCallback(async () => {
    if (!user?.id) {
      applyNotificationPrefs(
        setNotificationPrefs,
        notificationPrefsRef,
        DEFAULT_NOTIFICATION_PREFS
      );
      return DEFAULT_NOTIFICATION_PREFS;
    }

    try {
      const result = await settingsService.getUserSettings(user.id);
      if (result.success && result.data) {
        return updateNotificationPrefs(result.data);
      }
    } catch (error) {
      handleSessionAuthError(error, { silent: true });
    }

    return notificationPrefsRef.current;
  }, [user?.id, handleSessionAuthError, updateNotificationPrefs]);

  // Sync prefs when settings are saved elsewhere (e.g. Settings page)
  useEffect(() => {
    const handlePrefsChanged = (event) => {
      if (event.detail) {
        updateNotificationPrefs(event.detail);
      } else {
        loadNotificationPrefs();
      }
    };

    window.addEventListener(NOTIFICATION_PREFS_CHANGED_EVENT, handlePrefsChanged);
    return () => {
      window.removeEventListener(NOTIFICATION_PREFS_CHANGED_EVENT, handlePrefsChanged);
    };
  }, [updateNotificationPrefs, loadNotificationPrefs]);

  const fetchNotifications = useCallback(
    async (options = {}) => {
      const { append = false, filters = {} } = options;
      if (!user?.id) return;

      if (!append) {
        setLoading(true);
      }

      try {
        await ensureValidSession();
        const result = await notificationService.getUserNotifications(user.id, {
          ...filters,
          limit: NOTIFICATIONS_PAGE_SIZE,
          offset: append ? loadedOffsetRef.current : 0
        });

        if (result.success) {
          const deduped = notificationService.dedupeNotifications(result.data);
          if (append) {
            setNotifications((prev) => {
              const merged = notificationService.dedupeNotifications([
                ...prev,
                ...deduped.filter((n) => !prev.some((p) => p.id === n.id))
              ]);
              const newOnes = deduped.filter((n) => !prev.some((p) => p.id === n.id));
              loadedOffsetRef.current += newOnes.length;
              return merged;
            });
          } else {
            setNotifications(deduped);
            loadedOffsetRef.current = deduped.length;
          }
          setHasMoreNotifications(Boolean(result.hasMore));
        } else {
          console.error('Failed to fetch notifications:', result.error);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        handleSessionAuthError(error, { silent: true });
      } finally {
        if (!append) {
          setLoading(false);
        }
      }
    },
    [user?.id, handleSessionAuthError]
  );

  const loadMoreNotifications = useCallback(async () => {
    if (!user?.id || loadingMore || !hasMoreNotifications) return;

    setLoadingMore(true);
    try {
      await fetchNotifications({ append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [user?.id, loadingMore, hasMoreNotifications, fetchNotifications]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      await ensureValidSession();
      const result = await notificationService.getUnreadCount(user.id);

      if (result.success) {
        setStats((prev) => ({ ...prev, unread_count: result.count }));
      }
    } catch (error) {
      handleSessionAuthError(error, { silent: true });
    }
  }, [user?.id, handleSessionAuthError]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      await ensureValidSession();
      const result = await notificationService.getNotificationStats(user.id);

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      handleSessionAuthError(error, { silent: true });
    }
  }, [user?.id, handleSessionAuthError]);

  const refreshNotificationData = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchUnreadCount(), fetchStats()]);
  }, [fetchNotifications, fetchUnreadCount, fetchStats]);

  const showBrowserNotification = useCallback((title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }, []);

  const deliverNotificationAlert = useCallback(
    (notification) => {
      const prefs = notificationPrefsRef.current;

      if (shouldDeliverBrowserNotification(prefs, notification)) {
        if ('Notification' in window && Notification.permission === 'granted') {
          showBrowserNotification(notification.title, {
            body: notification.message,
            tag: notification.id
          });
        }
      }

      if (shouldPlayNotificationSound(prefs, notification)) {
        playNotificationSound();
      }
    },
    [showBrowserNotification]
  );

  const canManagePendingApprovals =
    user?.role === 'admin' ||
    user?.role === 'manager' ||
    user?.role === 'demo_admin';

  const checkPendingApprovals = useCallback(async () => {
    if (!user?.id) return;
    if (!canManagePendingApprovals) return;

    if (pendingApprovalsCheckRef.current) {
      return pendingApprovalsCheckRef.current;
    }

    const runCheck = (async () => {
      try {
        const result = await notificationService.getPendingApprovalsCount();
        if (!result.success) return;

        await notificationService.syncPendingApprovalNotification(user.id, result.count);
        await refreshNotificationData();
      } catch (error) {
        console.error('Error checking pending approvals:', error);
        handleSessionAuthError(error, { silent: true });
      } finally {
        pendingApprovalsCheckRef.current = null;
      }
    })();

    pendingApprovalsCheckRef.current = runCheck;
    return runCheck;
  }, [user?.id, canManagePendingApprovals, refreshNotificationData, handleSessionAuthError]);

  // Initial fetch when user logs in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setStats(EMPTY_STATS);
      setHasMoreNotifications(false);
      loadedOffsetRef.current = 0;
      applyNotificationPrefs(
        setNotificationPrefs,
        notificationPrefsRef,
        DEFAULT_NOTIFICATION_PREFS
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      await loadNotificationPrefs();
      // Heal + clear stale pending-approval notice BEFORE the first list fetch,
      // otherwise React state keeps the sample until a second refresh.
      if (canManagePendingApprovals) {
        try {
          const result = await notificationService.getPendingApprovalsCount();
          if (result.success) {
            await notificationService.syncPendingApprovalNotification(user.id, result.count);
          }
        } catch (error) {
          console.error('Error syncing pending approvals on init:', error);
          handleSessionAuthError(error, { silent: true });
        }
      }
      if (cancelled) return;
      await Promise.all([fetchNotifications(), fetchUnreadCount(), fetchStats()]);
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    user?.id,
    canManagePendingApprovals,
    fetchNotifications,
    fetchUnreadCount,
    fetchStats,
    loadNotificationPrefs,
    handleSessionAuthError
  ]);

  // Re-sync when tab becomes visible
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      await loadNotificationPrefs();
      await refreshNotificationData();
      if (canManagePendingApprovals) {
        await checkPendingApprovals();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [
    isAuthenticated,
    user?.id,
    canManagePendingApprovals,
    loadNotificationPrefs,
    refreshNotificationData,
    checkPendingApprovals
  ]);

  const handleRealtimePayload = useCallback(
    (payload) => {
      const eventType = getRealtimeEventType(payload);

      if (eventType === 'INSERT' && payload.new) {
        const isPendingApprovalInsert =
          payload.new.title === notificationService.PENDING_APPROVAL_TITLE &&
          payload.new.category === notificationService.PENDING_APPROVAL_CATEGORY;

        let deleteDuplicateInsert = false;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === payload.new.id)) return prev;

          if (
            isPendingApprovalInsert &&
            prev.some(
              (n) =>
                n.title === notificationService.PENDING_APPROVAL_TITLE &&
                n.category === notificationService.PENDING_APPROVAL_CATEGORY
            )
          ) {
            deleteDuplicateInsert = true;
            return prev;
          }

          return notificationService.dedupeNotifications([payload.new, ...prev]);
        });

        if (deleteDuplicateInsert) {
          notificationService.deleteNotification(payload.new.id);
        }

        if (isPendingApprovalInsert) {
          fetchUnreadCount();
          fetchStats();
        } else {
          setStats((prev) => ({
            ...prev,
            total_notifications: prev.total_notifications + 1,
            unread_count: !payload.new.is_read ? prev.unread_count + 1 : prev.unread_count,
            error_count:
              payload.new.type === 'error' ? prev.error_count + 1 : prev.error_count,
            warning_count:
              payload.new.type === 'warning' ? prev.warning_count + 1 : prev.warning_count,
            latest_notification_at: payload.new.created_at || prev.latest_notification_at
          }));
        }

        deliverNotificationAlert(payload.new);
        return;
      }

      if (eventType === 'UPDATE' && payload.new) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === payload.new.id ? payload.new : n))
        );
        if (payload.old && payload.new.is_read !== payload.old.is_read) {
          fetchUnreadCount();
          fetchStats();
        }
        return;
      }

      if (eventType === 'DELETE' && payload.old) {
        setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        setStats((prev) => ({
          ...prev,
          total_notifications: Math.max(0, prev.total_notifications - 1),
          unread_count: !payload.old.is_read
            ? Math.max(0, prev.unread_count - 1)
            : prev.unread_count,
          error_count:
            payload.old.type === 'error'
              ? Math.max(0, prev.error_count - 1)
              : prev.error_count,
          warning_count:
            payload.old.type === 'warning'
              ? Math.max(0, prev.warning_count - 1)
              : prev.warning_count
        }));
      }
    },
    [fetchUnreadCount, fetchStats, deliverNotificationAlert]
  );

  // Subscribe to real-time notification updates
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const subscription = notificationService.subscribeToNotifications(
      user.id,
      handleRealtimePayload
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated, user?.id, handleRealtimePayload]);

  // Subscribe to time entry changes (production) or demo storage updates
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (!canManagePendingApprovals) return;

    const schedulePendingCheck = () => {
      if (pendingApprovalsDebounceRef.current) {
        clearTimeout(pendingApprovalsDebounceRef.current);
      }
      pendingApprovalsDebounceRef.current = setTimeout(() => {
        checkPendingApprovals();
      }, 500);
    };

    let channel = null;

    if (!isDemoMode()) {
      channel = supabase
        .channel(`time_entries_pending_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'time_entries'
          },
          schedulePendingCheck
        )
        .subscribe();
    }

    const handleDemoStorage = (event) => {
      if (event.key === DEMO_TIME_ENTRIES_KEY) {
        schedulePendingCheck();
      }
    };

    const handleDemoTimeEntriesChanged = () => {
      schedulePendingCheck();
    };

    window.addEventListener('storage', handleDemoStorage);
    window.addEventListener('demo-time-entries-changed', handleDemoTimeEntriesChanged);

    return () => {
      if (pendingApprovalsDebounceRef.current) {
        clearTimeout(pendingApprovalsDebounceRef.current);
        pendingApprovalsDebounceRef.current = null;
      }
      if (channel) channel.unsubscribe();
      window.removeEventListener('storage', handleDemoStorage);
      window.removeEventListener('demo-time-entries-changed', handleDemoTimeEntriesChanged);
    };
  }, [isAuthenticated, user?.id, canManagePendingApprovals, checkPendingApprovals]);

  const markManyAsRead = useCallback(
    async (notificationIds) => {
      if (!notificationIds?.length) {
        return { success: true };
      }

      const uniqueIds = [...new Set(notificationIds)];
      const snapshot = { notifications, stats };
      const idSet = new Set(uniqueIds);
      let unreadDelta = 0;

      setNotifications((prev) =>
        prev.map((n) => {
          if (idSet.has(n.id) && !n.is_read) {
            unreadDelta += 1;
            return { ...n, is_read: true, read_at: new Date().toISOString() };
          }
          return n;
        })
      );

      if (unreadDelta > 0) {
        setStats((prev) => ({
          ...prev,
          unread_count: Math.max(0, prev.unread_count - unreadDelta)
        }));
      }

      const result = await notificationService.markManyAsRead(uniqueIds);

      if (!result.success) {
        setNotifications(snapshot.notifications);
        setStats(snapshot.stats);
      }

      return result;
    },
    [notifications, stats]
  );

  const markAsRead = useCallback(
    async (notificationId) => {
      const snapshot = { notifications, stats };
      const readAt = new Date().toISOString();

      let wasUnread = false;
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === notificationId);
        wasUnread = Boolean(target && !target.is_read);
        return prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: readAt } : n
        );
      });
      if (wasUnread) {
        setStats((prev) => ({
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1)
        }));
      }

      const result = await notificationService.markAsRead(notificationId);

      if (!result.success) {
        setNotifications(snapshot.notifications);
        setStats(snapshot.stats);
        showActionError(
          t(
            'notifications.actionFailedMarkRead',
            'Could not mark notification as read. Please try again.'
          )
        );
      }

      return result;
    },
    [notifications, stats, showActionError, t]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    const snapshot = { notifications, stats };
    const readAt = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: readAt }))
    );
    setStats((prev) => ({ ...prev, unread_count: 0 }));

    const result = await notificationService.markAllAsRead(user.id);

    if (!result.success) {
      setNotifications(snapshot.notifications);
      setStats(snapshot.stats);
      showActionError(
        t(
          'notifications.actionFailedMarkAllRead',
          'Could not mark all notifications as read. Please try again.'
        )
      );
    }

    return result;
  }, [user?.id, notifications, stats, showActionError, t]);

  const deleteNotification = useCallback(
    async (notificationId) => {
      const snapshot = { notifications, stats };

      let removed = null;
      setNotifications((prev) => {
        removed = prev.find((n) => n.id === notificationId);
        return prev.filter((n) => n.id !== notificationId);
      });

      if (removed) {
        setStats((prev) => ({
          ...prev,
          total_notifications: Math.max(0, prev.total_notifications - 1),
          unread_count: removed.is_read
            ? prev.unread_count
            : Math.max(0, prev.unread_count - 1),
          error_count:
            removed.type === 'error'
              ? Math.max(0, prev.error_count - 1)
              : prev.error_count,
          warning_count:
            removed.type === 'warning'
              ? Math.max(0, prev.warning_count - 1)
              : prev.warning_count
        }));
      }

      const result = await notificationService.deleteNotification(notificationId);

      if (!result.success) {
        setNotifications(snapshot.notifications);
        setStats(snapshot.stats);
        showActionError(
          t(
            'notifications.actionFailedDelete',
            'Could not delete notification. Please try again.'
          )
        );
      }

      return result;
    },
    [notifications, stats, showActionError, t]
  );

  const deleteAllNotifications = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    const snapshot = { notifications, stats };

    setNotifications([]);
    setStats(EMPTY_STATS);

    const result = await notificationService.deleteAllNotifications(user.id);

    if (!result.success) {
      setNotifications(snapshot.notifications);
      setStats(snapshot.stats);
      showActionError(
        t(
          'notifications.actionFailedDeleteAll',
          'Could not delete all notifications. Please try again.'
        )
      );
    }

    return result;
  }, [user?.id, notifications, stats, showActionError, t]);

  const createNotification = useCallback(
    async (notification) => {
      const result = await notificationService.createNotification(notification);

      if (result.success && result.data && notification.userId === user?.id) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === result.data.id)) return prev;
          return [result.data, ...prev];
        });
        setStats((prev) => ({
          ...prev,
          total_notifications: prev.total_notifications + 1,
          unread_count: result.data.is_read ? prev.unread_count : prev.unread_count + 1,
          error_count:
            result.data.type === 'error' ? prev.error_count + 1 : prev.error_count,
          warning_count:
            result.data.type === 'warning' ? prev.warning_count + 1 : prev.warning_count,
          latest_notification_at: result.data.created_at || prev.latest_notification_at
        }));
        deliverNotificationAlert(result.data);
      }

      return result;
    },
    [user?.id, deliverNotificationAlert]
  );

  const getFilteredNotifications = useCallback((filters) => {
    let filtered = [...notifications];

    if (filters.isRead !== undefined) {
      filtered = filtered.filter((n) => n.is_read === filters.isRead);
    }

    if (filters.type) {
      filtered = filtered.filter((n) => n.type === filters.type);
    }

    if (filters.category) {
      filtered = filtered.filter((n) => n.category === filters.category);
    }

    return filtered;
  }, [notifications]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      stats,
      notificationPrefs,
      fetchNotifications,
      refreshNotificationData,
      loadMoreNotifications,
      hasMoreNotifications,
      loadingMore,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllNotifications,
      createNotification,
      getFilteredNotifications,
      showBrowserNotification,
      requestNotificationPermission,
      loadNotificationPrefs,
      updateNotificationPrefs,
      checkPendingApprovals
    }),
    [
      notifications,
      unreadCount,
      loading,
      stats,
      notificationPrefs,
      fetchNotifications,
      refreshNotificationData,
      loadMoreNotifications,
      hasMoreNotifications,
      loadingMore,
      markAsRead,
      markManyAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllNotifications,
      createNotification,
      getFilteredNotifications,
      showBrowserNotification,
      requestNotificationPermission,
      loadNotificationPrefs,
      updateNotificationPrefs,
      checkPendingApprovals
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast toast={toast} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
};
