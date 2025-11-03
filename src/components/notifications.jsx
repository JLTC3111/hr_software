import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, X, Filter, AlertCircle, Info, CheckCircle, AlertTriangle, Inbox, ExternalLink, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

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
    fetchNotifications
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [updatingNotifications, setUpdatingNotifications] = useState(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track previous unread count to detect changes
  const [prevUnreadCount, setPrevUnreadCount] = useState(unreadCount);

  // Show a subtle animation when unread count changes
  useEffect(() => {
    if (prevUnreadCount !== unreadCount && !loading) {
      console.log('📊 Unread count updated:', prevUnreadCount, '→', unreadCount);
      setPrevUnreadCount(unreadCount);
    }
  }, [unreadCount, prevUnreadCount, loading]);

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotifications();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread' && notification.is_read) return false;
    if (filter === 'read' && !notification.is_read) return false;
    if (categoryFilter !== 'all' && notification.category !== categoryFilter) return false;
    if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
    return true;
  });

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
        return isDarkMode ? 'border-yellow-700 bg-blue-900/20' : 'border-yellow-200 bg-yellow-50';
      default:
        return isDarkMode ? 'border-blue-700 bg-blue-900/20' : 'border-blue-200 bg-blue-50';
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
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

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      setUpdatingNotifications(prev => new Set(prev).add(notification.id));
      await markAsRead(notification.id);
      setUpdatingNotifications(prev => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }

    // Navigate if action URL exists
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    setUpdatingNotifications(prev => new Set(prev).add(notificationId));
    await deleteNotification(notificationId);
    // No need to remove from updatingNotifications as the notification is deleted
  };

  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    setUpdatingNotifications(prev => new Set(prev).add(notificationId));
    await markAsRead(notificationId);
    setUpdatingNotifications(prev => {
      const next = new Set(prev);
      next.delete(notificationId);
      return next;
    });
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
    const timeEntriesMatch = message.match(/You have (\d+) time entries awaiting approval/);
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

  if (loading && notifications.length === 0) {
    return (
      <div className={`p-8 ${bg.primary}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 ${bg.primary} min-h-screen`}>
      <div className="max-w-7xl mx-auto gap-7">
        {/* Header */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mb-6`}>
          <div className="flex items-center space-x-3 mb-4">
            <Bell className={`h-8 w-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
            <h1 className={`text-4xl font-bold ${text.primary}`}>
              {t('notifications.title', 'Notifications')}
            </h1>
          </div>
          
          {/* Action Buttons - Separated from header */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50`}
              title={t('notifications.refresh', 'Refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('notifications.refresh', 'Refresh')}</span>
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer`}
              title={t('notifications.filters', 'Filters')}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t('notifications.filters', 'Filters')}</span>
            </button>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer`}
                title={t('notifications.markAllRead', 'Mark all as read')}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t('notifications.markAllRead', 'Mark all as read')}</span>
              </button>
            )}
            
            {notifications.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(t('notifications.confirmDeleteAll', 'Are you sure you want to delete all notifications?'))) {
                    deleteAllNotifications();
                  }
                }}
                className={`px-4 py-2 rounded-lg ${hover.bg} ${text.secondary} flex items-center space-x-2 transition-colors cursor-pointer`}
                title={t('notifications.deleteAll', 'Delete all')}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('notifications.deleteAll', 'Delete all')}</span>
              </button>
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className={`p-3 rounded-lg bg-transparent border ${border.primary}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.total', 'Total')}</p>
              <p className={`text-2xl font-bold ${text.primary}`}>{stats.total_notifications}</p>
            </div>
            <div className={`p-3 rounded-lg bg-transparent border ${border.primary}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.unread', 'Unread')}</p>
              <p className={`text-2xl font-bold ${text.primary}`}>{stats.unread_count}</p>
            </div>
            <div className={`p-3 rounded-lg bg-transparent border ${border.primary}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.errors', 'Errors')}</p>
              <p className={`text-2xl font-bold ${text.primary}`}>{stats.error_count}</p>
            </div>
            <div className={`p-3 rounded-lg bg-transparent border ${border.primary}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.warnings', 'Warnings')}</p>
              <p className={`text-2xl font-bold ${text.primary}`}>{stats.warning_count}</p>
            </div>
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
                {filter !== 'all' 
                  ? t('notifications.noNotificationsFilter', 'No notifications match your filters')
                  : t('notifications.noNotificationsYet', 'You don\'t have any notifications yet')
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`rounded-lg shadow-sm
                  ${getTypeColor(notification.type)}
                  ${notification.action_url ? 'cursor-pointer hover:shadow-md' : ''}
                  ${!notification.is_read ? 'border-l-blue-600' : border.primary}
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
                            {getTranslatedTitle(notification.title)}
                          </h4>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className={`text-sm ${text.secondary} mt-1`}>
                          {getTranslatedMessage(notification.message)}
                        </p>
                        
                        {/* Action Button */}
                        {notification.action_url && notification.action_label && (
                          <button
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                          >
                            <span>{getTranslatedActionLabel(notification.action_label)}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
