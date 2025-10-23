import { supabase } from '../config/supabaseClient';

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @param {object} filters - Optional filters
 * @returns {Promise<object>} Result with notifications data
 */
export const getUserNotifications = async (userId, filters = {}) => {
  try {
    let query = supabase
      .from('hr_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.isRead !== undefined) {
      query = query.eq('is_read', filters.isRead);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    // Filter out expired notifications
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result with count
 */
export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('hr_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (error) throw error;

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

/**
 * Create a new notification
 * @param {object} notification - Notification data
 * @returns {Promise<object>} Result with created notification
 */
export const createNotification = async (notification) => {
  try {
    const { data, error } = await supabase
      .from('hr_notifications')
      .insert([{
        user_id: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type || 'info',
        category: notification.category || 'general',
        action_url: notification.actionUrl,
        action_label: notification.actionLabel,
        metadata: notification.metadata || {},
        expires_at: notification.expiresAt
      }])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<object>} Result
 */
export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('hr_notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result
 */
export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('hr_notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @returns {Promise<object>} Result
 */
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('hr_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete all notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result
 */
export const deleteAllNotifications = async (userId) => {
  try {
    const { error } = await supabase
      .from('hr_notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to real-time notification changes for a user
 * @param {string} userId - User ID
 * @param {function} callback - Callback function for changes
 * @returns {object} Subscription object
 */
export const subscribeToNotifications = (userId, callback) => {
  const subscription = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'hr_notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * Get notification statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Result with statistics
 */
export const getNotificationStats = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Changed from .single() to .maybeSingle() to handle cases where no stats exist

    if (error) throw error;

    return { 
      success: true, 
      data: data || {
        user_id: userId,
        total_notifications: 0,
        unread_count: 0,
        error_count: 0,
        warning_count: 0,
        latest_notification_at: null
      }
    };
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return { 
      success: false, 
      error: error.message,
      data: {
        user_id: userId,
        total_notifications: 0,
        unread_count: 0,
        error_count: 0,
        warning_count: 0,
        latest_notification_at: null
      }
    };
  }
};

/**
 * Bulk create notifications for multiple users
 * @param {array} notifications - Array of notification objects
 * @returns {Promise<object>} Result
 */
export const bulkCreateNotifications = async (notifications) => {
  try {
    const formattedNotifications = notifications.map(n => ({
      user_id: n.userId,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      category: n.category || 'general',
      action_url: n.actionUrl,
      action_label: n.actionLabel,
      metadata: n.metadata || {},
      expires_at: n.expiresAt
    }));

    const { data, error } = await supabase
      .from('hr_notifications')
      .insert(formattedNotifications)
      .select();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error bulk creating notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify all managers about an event
 * @param {object} notification - Notification data (without userId)
 * @returns {Promise<object>} Result
 */
export const notifyAllManagers = async (notification) => {
  try {
    // Get all managers
    const { data: managers, error: managersError } = await supabase
      .from('hr_users')
      .select('id')
      .in('role', ['manager', 'admin']);

    if (managersError) throw managersError;

    if (!managers || managers.length === 0) {
      return { success: true, message: 'No managers found' };
    }

    // Create notifications for all managers
    const notifications = managers.map(manager => ({
      ...notification,
      userId: manager.id
    }));

    return await bulkCreateNotifications(notifications);
  } catch (error) {
    console.error('Error notifying managers:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify specific user about an event
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} options - Additional options (type, category, etc.)
 * @returns {Promise<object>} Result
 */
export const notifyUser = async (userId, title, message, options = {}) => {
  return await createNotification({
    userId,
    title,
    message,
    type: options.type || 'info',
    category: options.category || 'general',
    actionUrl: options.actionUrl,
    actionLabel: options.actionLabel,
    metadata: options.metadata,
    expiresAt: options.expiresAt
  });
};
