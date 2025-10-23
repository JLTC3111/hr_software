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
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, fetchNotifications, fetchUnreadCount, fetchStats]);

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
          }
        } else if (payload.eventType === 'DELETE') {
          // Deleted notification
          setNotifications(prev =>
            prev.filter(n => n.id !== payload.old.id)
          );
          if (!payload.old.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isAuthenticated, user?.id, fetchUnreadCount, fetchStats]);

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
