import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, X, Filter, AlertCircle, Info, CheckCircle, AlertTriangle, Inbox, ExternalLink } from 'lucide-react';
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
    deleteAllNotifications
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

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
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
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
      await markAsRead(notification.id);
    }

    // Navigate if action URL exists
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    await markAsRead(notificationId);
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-6 mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Bell className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className={`text-2xl font-bold ${text.primary}`}>
                  {t('notifications.title', 'Notifications')}
                </h1>
                <p className={`text-sm ${text.secondary}`}>
                  {unreadCount > 0 
                    ? t('notifications.unreadCount', `${unreadCount} unread`).replace('{0}', unreadCount)
                    : t('notifications.allCaughtUp', 'You\'re all caught up!')
                  }
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
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
                  <span className="hidden sm:inline">{t('notifications.markAllRead', 'Mark all read')}</span>
                </button>
              )}
              
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm(t('notifications.confirmDeleteAll', 'Are you sure you want to delete all notifications?'))) {
                      deleteAllNotifications();
                    }
                  }}
                  className={`px-4 py-2 rounded-lg ${hover.bg} text-red-600 flex items-center space-x-2 transition-colors cursor-pointer`}
                  title={t('notifications.deleteAll', 'Delete all')}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('notifications.deleteAll', 'Delete all')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.total', 'Total')}</p>
              <p className={`text-2xl font-bold ${text.primary}`}>{stats.total_notifications}</p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.unread', 'Unread')}</p>
              <p className={`text-2xl font-bold text-blue-600`}>{stats.unread_count}</p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-red-900/30' : 'bg-red-50'}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.errors', 'Errors')}</p>
              <p className={`text-2xl font-bold text-red-600`}>{stats.error_count}</p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
              <p className={`text-xs ${text.secondary}`}>{t('notifications.warnings', 'Warnings')}</p>
              <p className={`text-2xl font-bold text-yellow-600`}>{stats.warning_count}</p>
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
                className={`
                  ${bg.secondary} rounded-lg shadow-sm border-l-4 
                  ${getTypeColor(notification.type)}
                  ${notification.action_url ? 'cursor-pointer hover:shadow-md' : ''}
                  ${!notification.is_read ? 'border-l-blue-600' : border.primary}
                  p-4 transition-all duration-200
                `}
              >
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-semibold ${text.primary}`}>
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className={`text-sm ${text.secondary} mt-1`}>
                          {notification.message}
                        </p>
                        
                        {/* Action Button */}
                        {notification.action_url && notification.action_label && (
                          <button
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                          >
                            <span>{notification.action_label}</span>
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
                          className={`p-2 rounded-lg ${hover.bg} text-red-600 transition-colors cursor-pointer`}
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
                        {notification.category}
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
