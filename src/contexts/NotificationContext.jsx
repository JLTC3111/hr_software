import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { ensureValidSession } from '../hooks/useSessionGuard.js';
import { supabase } from '../config/supabaseClient.js';
import * as notificationService from '../services/notificationService.js';

const NotificationContext = createContext();

const PENDING_APPROVAL_TITLE = 'Pending Approvals';

const EMPTY_STATS = {
  total_notifications: 0,
  unread_count: 0,
  error_count: 0,
  warning_count: 0,
  latest_notification_at: null
};

/** Supabase realtime payloads use eventType; some clients expose event */
const getRealtimeEventType = (payload) => payload?.eventType || payload?.event;

const isPendingApprovalNotification = (notification, { unreadOnly = false } = {}) =>
  notification.category === 'time_tracking' &&
  notification.type === 'warning' &&
  notification.title === PENDING_APPROVAL_TITLE &&
  (!unreadOnly || !notification.is_read);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated, handleSessionAuthError } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(EMPTY_STATS);
  const pendingApprovalsDebounceRef = useRef(null);

  const fetchNotifications = useCallback(async (filters = {}) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await ensureValidSession();
      const result = await notificationService.getUserNotifications(user.id, filters);

      if (result.success) {
        setNotifications(result.data);
      } else {
        console.error('Failed to fetch notifications:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      handleSessionAuthError(error, { silent: true });
    } finally {
      setLoading(false);
    }
  }, [user?.id, handleSessionAuthError]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      await ensureValidSession();
      const result = await notificationService.getUnreadCount(user.id);

      if (result.success) {
        setUnreadCount(result.count);
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

  const loadPendingApprovalNotifications = useCallback(async (unreadOnly = false) => {
    if (!user?.id) return [];

    const result = await notificationService.getUserNotifications(user.id, {
      category: 'time_tracking',
      type: 'warning',
      ...(unreadOnly ? { isRead: false } : {})
    });

    if (!result.success) return [];
    return result.data.filter((n) => isPendingApprovalNotification(n, { unreadOnly }));
  }, [user?.id]);

  const checkPendingApprovals = useCallback(async () => {
    if (!user?.id) return;
    if (user.role !== 'admin' && user.role !== 'manager') return;

    try {
      await notificationService.cleanupDuplicateNotifications(
        user.id,
        PENDING_APPROVAL_TITLE,
        'time_tracking'
      );

      const result = await notificationService.getPendingApprovalsCount();
      if (!result.success) return;

      const pendingMessage = (count) =>
        `You have ${count} time ${count === 1 ? 'entry' : 'entries'} awaiting approval`;

      const notifyOptions = (count) => ({
        type: 'warning',
        category: 'time_tracking',
        actionUrl: '/time-clock',
        actionLabel: 'Review Now',
        metadata: { pendingCount: count }
      });

      if (result.count > 0) {
        const existingUnread = await loadPendingApprovalNotifications(true);

        if (existingUnread.length === 0) {
          await notificationService.notifyUser(
            user.id,
            PENDING_APPROVAL_TITLE,
            pendingMessage(result.count),
            notifyOptions(result.count)
          );
          await refreshNotificationData();
        } else {
          const currentCount = existingUnread[0].metadata?.pendingCount ?? 0;
          if (currentCount !== result.count) {
            await notificationService.deleteNotification(existingUnread[0].id);
            await notificationService.notifyUser(
              user.id,
              PENDING_APPROVAL_TITLE,
              pendingMessage(result.count),
              notifyOptions(result.count)
            );
            await refreshNotificationData();
          }
        }
      } else {
        const existing = await loadPendingApprovalNotifications(false);

        if (existing.length > 0) {
          for (const notification of existing) {
            await notificationService.deleteNotification(notification.id);
          }
          await refreshNotificationData();
        }
      }
    } catch (error) {
      console.error('Error checking pending approvals:', error);
      handleSessionAuthError(error, { silent: true });
    }
  }, [
    user?.id,
    user?.role,
    loadPendingApprovalNotifications,
    refreshNotificationData,
    handleSessionAuthError
  ]);

  // Initial fetch when user logs in; run pending-approval check after data is loaded
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      await Promise.all([fetchNotifications(), fetchUnreadCount(), fetchStats()]);
      if (!cancelled && (user.role === 'admin' || user.role === 'manager')) {
        await checkPendingApprovals();
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    user?.id,
    user?.role,
    fetchNotifications,
    fetchUnreadCount,
    fetchStats,
    checkPendingApprovals
  ]);

  const handleRealtimePayload = useCallback((payload) => {
    const eventType = getRealtimeEventType(payload);

    if (eventType === 'INSERT' && payload.new) {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === payload.new.id)) return prev;
        return [payload.new, ...prev];
      });
      if (!payload.new.is_read) {
        setUnreadCount((prev) => prev + 1);
      }
      fetchStats();
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
      if (!payload.old.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      fetchStats();
    }
  }, [fetchUnreadCount, fetchStats]);

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

  // Subscribe to time entry changes for pending-approval notifications (managers/admins)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (user.role !== 'admin' && user.role !== 'manager') return;

    const channel = supabase
      .channel(`time_entries_pending_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: 'status=eq.pending'
        },
        () => {
          if (pendingApprovalsDebounceRef.current) {
            clearTimeout(pendingApprovalsDebounceRef.current);
          }
          pendingApprovalsDebounceRef.current = setTimeout(() => {
            checkPendingApprovals();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (pendingApprovalsDebounceRef.current) {
        clearTimeout(pendingApprovalsDebounceRef.current);
        pendingApprovalsDebounceRef.current = null;
      }
      channel.unsubscribe();
    };
  }, [isAuthenticated, user?.id, user?.role, checkPendingApprovals]);

  const markAsRead = useCallback(async (notificationId) => {
    const result = await notificationService.markAsRead(notificationId);

    if (result.success) {
      let wasUnread = false;
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === notificationId);
        wasUnread = Boolean(target && !target.is_read);
        return prev.map((n) =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        );
      });
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setStats((prev) => ({
          ...prev,
          unread_count: Math.max(0, prev.unread_count - 1)
        }));
      }
    }

    return result;
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    const result = await notificationService.markAllAsRead(user.id);

    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setStats((prev) => ({
        ...prev,
        unread_count: 0
      }));
    }

    return result;
  }, [user?.id]);

  const deleteNotification = useCallback(async (notificationId) => {
    const result = await notificationService.deleteNotification(notificationId);

    if (result.success) {
      let removed = null;
      setNotifications((prev) => {
        removed = prev.find((n) => n.id === notificationId);
        return prev.filter((n) => n.id !== notificationId);
      });

      if (removed) {
        if (!removed.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
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
    }

    return result;
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    const result = await notificationService.deleteAllNotifications(user.id);

    if (result.success) {
      setNotifications([]);
      setUnreadCount(0);
      setStats(EMPTY_STATS);
    }

    return result;
  }, [user?.id]);

  const createNotification = useCallback(async (notification) => {
    return notificationService.createNotification(notification);
  }, []);

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

  const showBrowserNotification = useCallback((title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }, []);

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
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllNotifications,
      createNotification,
      getFilteredNotifications,
      showBrowserNotification,
      requestNotificationPermission
    }),
    [
      notifications,
      unreadCount,
      loading,
      stats,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllNotifications,
      createNotification,
      getFilteredNotifications,
      showBrowserNotification,
      requestNotificationPermission
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
