import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as notificationService from '../services/notificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_notifications: 0,
    unread_count: 0,
    error_count: 0,
    warning_count: 0,
    latest_notification_at: null
  });

  // Fetch notifications
  const fetchNotifications = useCallback(async (filters = {}) => {
    if (!user?.id) return;

    setLoading(true);
    const result = await notificationService.getUserNotifications(user.id, filters);
    
    if (result.success) {
      setNotifications(result.data);
    } else {
      console.error('Failed to fetch notifications:', result.error);
    }
    
    setLoading(false);
  }, [user?.id]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    const result = await notificationService.getUnreadCount(user.id);
    
    if (result.success) {
      setUnreadCount(result.count);
    }
  }, [user?.id]);

  // Fetch notification stats
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    const result = await notificationService.getNotificationStats(user.id);
    
    if (result.success && result.data) {
      setStats(result.data);
    }
  }, [user?.id]);

  // Initial fetch when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchNotifications();
      fetchUnreadCount();
      fetchStats();
      
      // Check for pending approvals if user is admin/manager
      if (user.role === 'admin' || user.role === 'hr_admin' || user.role === 'manager') {
        checkPendingApprovals();
      }
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, fetchNotifications, fetchUnreadCount, fetchStats]);

  // Check for pending approvals and create notification if needed
  const checkPendingApprovals = useCallback(async () => {
    if (!user?.id) return;

    try {
      // First, clean up any duplicate pending approval notifications
      await notificationService.cleanupDuplicateNotifications(
        user.id,
        'Pending Approvals',
        'time_tracking'
      );

      const result = await notificationService.getPendingApprovalsCount();
    
      if (result.success && result.count > 0) {
        // Check if there's already ANY unread notification about pending approvals
        const existingPendingNotifications = notifications.filter(n => 
          n.category === 'time_tracking' && 
          n.type === 'warning' &&
          n.title === 'Pending Approvals' &&
          !n.is_read
        );

        if (existingPendingNotifications.length === 0) {
          // No existing notification, create new one
          await notificationService.notifyUser(
            user.id,
            'Pending Approvals',
            `You have ${result.count} time ${result.count === 1 ? 'entry' : 'entries'} awaiting approval`,
            {
              type: 'warning',
              category: 'time_tracking',
              actionUrl: '/time-clock',
              actionLabel: 'Review Now',
              metadata: { pendingCount: result.count }
            }
          );
          // Refresh notifications to show the new one
          fetchNotifications();
        } else {
          // Check if count has changed and update if needed
          const currentCount = existingPendingNotifications[0].metadata?.pendingCount || 0;
          if (currentCount !== result.count) {
            // Delete old and create new with updated count
            await notificationService.deleteNotification(existingPendingNotifications[0].id);
            await notificationService.notifyUser(
              user.id,
              'Pending Approvals',
              `You have ${result.count} time ${result.count === 1 ? 'entry' : 'entries'} awaiting approval`,
              {
                type: 'warning',
                category: 'time_tracking',
                actionUrl: '/time-clock',
                actionLabel: 'Review Now',
                metadata: { pendingCount: result.count }
              }
            );
            fetchNotifications();
          }
        }
      } else if (result.success && result.count === 0) {
        // No pending approvals, delete any existing pending approval notifications
        const existingPendingNotifications = notifications.filter(n => 
          n.category === 'time_tracking' && 
          n.type === 'warning' &&
          n.title === 'Pending Approvals'
        );
        
        for (const notification of existingPendingNotifications) {
          await notificationService.deleteNotification(notification.id);
        }
        
        if (existingPendingNotifications.length > 0) {
          fetchNotifications();
        }
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      // Silently fail - don't disrupt user experience
    }
  }, [user?.id, notifications, fetchNotifications]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const subscription = notificationService.subscribeToNotifications(
      user.id,
      (payload) => {
        console.log('Notification update:', payload);

        if (payload.eventType === 'INSERT') {
          // New notification
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
          fetchStats();
        } else if (payload.eventType === 'UPDATE') {
          // Updated notification
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          );
          if (payload.new.is_read !== payload.old.is_read) {
            fetchUnreadCount();
            fetchStats();
          }
        } else if (payload.eventType === 'DELETE') {
          // Deleted notification
          setNotifications(prev =>
            prev.filter(n => n.id !== payload.old.id)
          );
          if (!payload.old.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
          fetchStats();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated, user?.id, fetchUnreadCount, fetchStats]);

  // Subscribe to time entries changes to update pending approvals notification in real-time
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    
    // Only subscribe if user is admin/manager
    if (user.role !== 'admin' && user.role !== 'hr_admin' && user.role !== 'manager') {
      return;
    }

    // Import supabase client dynamically to avoid circular dependencies
    import('../config/supabaseClient').then(({ supabase }) => {
      const channel = supabase
        .channel('time_entries_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'time_entries',
            filter: `approval_status=in.(pending,approved,rejected)`
          },
          (payload) => {
            console.log('Time entry changed:', payload);
            
            // Debounce the check to avoid too many calls
            setTimeout(() => {
              checkPendingApprovals();
            }, 500);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    });
  }, [isAuthenticated, user?.id, user?.role, checkPendingApprovals]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    const result = await notificationService.markAsRead(notificationId);
    
    if (result.success) {
      setNotifications(prev =>
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update stats immediately
      setStats(prev => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1)
      }));
    }
    
    return result;
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    const result = await notificationService.markAllAsRead(user.id);
    
    if (result.success) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      
      // Update stats immediately
      setStats(prev => ({
        ...prev,
        unread_count: 0
      }));
    }
    
    return result;
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    const result = await notificationService.deleteNotification(notificationId);
    
    if (result.success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Update stats immediately
        setStats(prev => ({
          ...prev,
          total_notifications: Math.max(0, prev.total_notifications - 1),
          unread_count: Math.max(0, prev.unread_count - 1),
          error_count: notification.type === 'error' ? Math.max(0, prev.error_count - 1) : prev.error_count,
          warning_count: notification.type === 'warning' ? Math.max(0, prev.warning_count - 1) : prev.warning_count
        }));
      } else if (notification) {
        // Even if read, update total count
        setStats(prev => ({
          ...prev,
          total_notifications: Math.max(0, prev.total_notifications - 1),
          error_count: notification.type === 'error' ? Math.max(0, prev.error_count - 1) : prev.error_count,
          warning_count: notification.type === 'warning' ? Math.max(0, prev.warning_count - 1) : prev.warning_count
        }));
      }
    }
    
    return result;
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    if (!user?.id) return;

    const result = await notificationService.deleteAllNotifications(user.id);
    
    if (result.success) {
      setNotifications([]);
      setUnreadCount(0);
      
      // Reset stats immediately
      setStats({
        total_notifications: 0,
        unread_count: 0,
        error_count: 0,
        warning_count: 0,
        latest_notification_at: null
      });
    }
    
    return result;
  };

  // Create notification (for system use)
  const createNotification = async (notification) => {
    return await notificationService.createNotification(notification);
  };

  // Get filtered notifications
  const getFilteredNotifications = (filters) => {
    let filtered = [...notifications];

    if (filters.isRead !== undefined) {
      filtered = filtered.filter(n => n.is_read === filters.isRead);
    }

    if (filters.type) {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    if (filters.category) {
      filtered = filtered.filter(n => n.category === filters.category);
    }

    return filtered;
  };

  // Show browser notification (if permission granted)
  const showBrowserNotification = (title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const value = {
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
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
