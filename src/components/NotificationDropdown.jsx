import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  getDemoNotificationTitle,
  getDemoNotificationMessage
} from '../utils/demoHelper';
import { resolveNotificationActionUrl } from '../utils/notificationNavigation';

const PREVIEW_LIMIT = 5;

const formatRelativeTime = (timestamp, t) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('notifications.justNow', 'Just now');
  if (minutes < 60) {
    return t('notifications.minutesAgo', '{0}m ago').replace('{0}', minutes);
  }
  if (hours < 24) return t('notifications.hoursAgo', '{0}h ago').replace('{0}', hours);
  if (days < 7) return t('notifications.daysAgo', '{0}d ago').replace('{0}', days);
  return date.toLocaleDateString();
};

const NotificationDropdown = () => {
  const { bg, text, border, hover, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const previewItems = useMemo(
    () => notifications.filter((n) => !n.is_read).slice(0, PREVIEW_LIMIT),
    [notifications]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const getTitle = (notification) => {
    const demo = getDemoNotificationTitle(notification, t);
    return demo && demo !== notification.title ? demo : notification.title;
  };

  const getMessage = (notification) => {
    const demo = getDemoNotificationMessage(notification, t);
    return demo && demo !== notification.message ? demo : notification.message;
  };

  const handleItemClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setOpen(false);
    const actionUrl = resolveNotificationActionUrl(notification);
    if (actionUrl) {
      navigate(actionUrl);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
          isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
        }`}
        title={t('header.notifications', 'Notifications')}
        aria-label={
          unreadCount > 0
            ? t('notifications.unreadCount', '{0} unread').replace('{0}', String(unreadCount))
            : t('header.notifications', 'Notifications')
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-lg shadow-lg border ${border.primary} ${bg.secondary} z-50 overflow-hidden`}
          role="menu"
        >
          <div className={`px-4 py-3 border-b ${border.primary} flex items-center justify-between`}>
            <h3 className={`font-semibold ${text.primary}`}>
              {t('notifications.title', 'Notifications')}
            </h3>
            {unreadCount > 0 && (
              <span className={`text-xs ${text.secondary}`}>
                {t('notifications.unreadCount', '{0} unread').replace('{0}', String(unreadCount))}
              </span>
            )}
          </div>

          {previewItems.length === 0 ? (
            <div className={`px-4 py-8 text-center ${text.secondary}`}>
              <CheckCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('notifications.allCaughtUp', "You're all caught up!")}
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {previewItems.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleItemClick(notification)}
                    className={`w-full text-left px-4 py-3 border-b ${border.primary} last:border-b-0 ${hover.bg} transition-colors cursor-pointer`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${text.primary} truncate`}>
                          {getTitle(notification)}
                        </p>
                        <p className={`text-xs ${text.secondary} mt-0.5 line-clamp-2`}>
                          {getMessage(notification)}
                        </p>
                        <p className={`text-xs ${text.secondary} mt-1 opacity-70`}>
                          {formatRelativeTime(notification.created_at, t)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className={`px-4 py-2 border-t ${border.primary}`}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className={`w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2 cursor-pointer`}
            >
              {t('notifications.viewAll', 'View all notifications')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
