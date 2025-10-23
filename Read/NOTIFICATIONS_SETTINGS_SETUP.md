# Notifications & Settings Setup Guide

This document provides comprehensive instructions for setting up and using the new Notifications and Settings features in the HR Management System.

## Overview

The system now includes:
- **Real-time Notifications System** with push notifications, filtering, and categorization
- **User Settings Management** with preferences for notifications, appearance, privacy, and work settings
- **Notification Badge** in the header showing unread count
- **Persistent Storage** in Supabase with real-time updates

## Database Setup

### 1. Run the Migration

Execute the following SQL migration in your Supabase SQL Editor:

```bash
# Location: supabase/migrations/008_notifications_and_settings.sql
```

This migration creates:
- `hr_notifications` table for storing user notifications
- `hr_user_settings` table for user preferences
- Helper functions for notification management
- Real-time triggers and views
- Indexes for performance optimization

### 2. Verify Tables

After running the migration, verify the tables exist:

```sql
SELECT * FROM hr_notifications LIMIT 5;
SELECT * FROM hr_user_settings LIMIT 5;
SELECT * FROM notification_stats;
```

## Features

### Notifications System

#### Features:
- **Real-time Updates**: Notifications appear instantly using Supabase real-time subscriptions
- **Categorization**: Notifications grouped by type (info, success, warning, error) and category (time_tracking, performance, employee, recruitment, system)
- **Filtering**: Filter by read/unread status, type, and category
- **Actions**: Mark as read, delete individual or all notifications
- **Statistics**: Dashboard showing total, unread, errors, and warnings count
- **Action Links**: Notifications can include action buttons that navigate to relevant pages

#### Notification Types:
- **Info**: General information notifications
- **Success**: Successful operation confirmations
- **Warning**: Important warnings that need attention
- **Error**: Critical errors that require immediate action

#### Notification Categories:
- **General**: General system notifications
- **Time Tracking**: Clock in/out, overtime, leave requests
- **Performance**: Review reminders, goal updates
- **Employee**: New hires, employee updates
- **Recruitment**: Application updates, interview schedules
- **System**: System maintenance, updates

### Settings System

#### Settings Sections:

**1. Notification Preferences**
- Email notifications toggle
- Push notifications toggle
- Desktop notifications toggle
- Notification frequency (real-time, daily, weekly)
- Category-specific notification settings

**2. Appearance Settings**
- Theme selection (light, dark, system)
- Date format customization
- Time format (12h/24h)
- Items per page configuration

**3. Language & Region**
- Language selection (9 languages supported)
- Timezone configuration
- Regional preferences

**4. Privacy Settings**
- Profile visibility (everyone, team, managers, private)
- Contact information visibility
- Email and phone display toggles

**5. Work Preferences**
- Default dashboard view
- Auto clock-out settings
- Weekly report subscription

## Usage

### Accessing Notifications

1. **Via Header**: Click the bell icon in the header
   - Badge shows unread count (displays "9+" for 10 or more)
   - Red badge indicates unread notifications

2. **Via Sidebar**: Navigate to "Notifications" in the Settings section

### Managing Notifications

```javascript
// Mark single notification as read
await markAsRead(notificationId);

// Mark all as read
await markAllAsRead();

// Delete notification
await deleteNotification(notificationId);

// Delete all notifications
await deleteAllNotifications();
```

### Creating Notifications Programmatically

```javascript
import * as notificationService from '../services/notificationService';

// Create a single notification
await notificationService.notifyUser(
  userId,
  'Performance Review Due',
  'Your Q4 2024 performance review is due next week.',
  {
    type: 'warning',
    category: 'performance',
    actionUrl: '/performance',
    actionLabel: 'View Reviews'
  }
);

// Notify all managers
await notificationService.notifyAllManagers({
  title: 'New Employee Onboarded',
  message: 'John Doe has been successfully onboarded.',
  type: 'success',
  category: 'employee',
  actionUrl: '/employees',
  actionLabel: 'View Employee'
});

// Bulk create notifications
await notificationService.bulkCreateNotifications([
  {
    userId: 'user-1-id',
    title: 'Notification 1',
    message: 'Message 1',
    type: 'info',
    category: 'general'
  },
  {
    userId: 'user-2-id',
    title: 'Notification 2',
    message: 'Message 2',
    type: 'success',
    category: 'system'
  }
]);
```

### Using Settings

```javascript
import * as settingsService from '../services/settingsService';

// Get user settings
const { data: settings } = await settingsService.getUserSettings(userId);

// Update settings
await settingsService.updateUserSettings(userId, {
  theme: 'dark',
  language: 'vn',
  email_notifications: true
});

// Update specific preference sections
await settingsService.updateNotificationPreferences(userId, {
  email_notifications: false,
  push_notifications: true
});

await settingsService.updateDisplayPreferences(userId, {
  theme: 'light',
  date_format: 'DD/MM/YYYY'
});

// Export settings
const { data: jsonData } = await settingsService.exportSettings(userId);

// Import settings
await settingsService.importSettings(userId, jsonString);

// Reset to defaults
await settingsService.resetToDefault(userId);
```

### Using Notification Context

```javascript
import { useNotifications } from '../contexts/NotificationContext';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    loading,
    stats,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestNotificationPermission
  } = useNotifications();

  // Request browser notification permission
  const handleEnableDesktop = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      console.log('Desktop notifications enabled!');
    }
  };

  return (
    <div>
      <p>You have {unreadCount} unread notifications</p>
      {/* ... */}
    </div>
  );
}
```

## Integration Examples

### Example 1: Send Notification on Clock In

```javascript
// In timeClockEntry.jsx or timeTrackingService.js
import * as notificationService from '../services/notificationService';

const handleClockIn = async (employeeId) => {
  // Clock in logic...
  
  // Send notification
  await notificationService.notifyUser(
    employeeId,
    'Clock In Successful',
    `You clocked in at ${new Date().toLocaleTimeString()}`,
    {
      type: 'success',
      category: 'time_tracking',
      actionUrl: '/time-tracking',
      actionLabel: 'View Time Tracking'
    }
  );
};
```

### Example 2: Notify on Performance Review

```javascript
// In performanceService.js
import * as notificationService from '../services/notificationService';

const submitPerformanceReview = async (employeeId, managerId, review) => {
  // Submit review logic...
  
  // Notify employee
  await notificationService.notifyUser(
    employeeId,
    'Performance Review Completed',
    'Your manager has completed your performance review.',
    {
      type: 'info',
      category: 'performance',
      actionUrl: '/performance',
      actionLabel: 'View Review'
    }
  );
};
```

### Example 3: System-wide Announcements

```javascript
import { supabase } from '../config/supabaseClient';
import * as notificationService from '../services/notificationService';

const sendSystemAnnouncement = async (title, message) => {
  // Get all active users
  const { data: users } = await supabase
    .from('hr_users')
    .select('id')
    .eq('is_active', true);

  // Create notifications for all users
  const notifications = users.map(user => ({
    userId: user.id,
    title,
    message,
    type: 'info',
    category: 'system'
  }));

  await notificationService.bulkCreateNotifications(notifications);
};
```

## API Reference

### Notification Service Functions

- `getUserNotifications(userId, filters)` - Get notifications with optional filters
- `getUnreadCount(userId)` - Get unread notification count
- `createNotification(notification)` - Create a new notification
- `markAsRead(notificationId)` - Mark notification as read
- `markAllAsRead(userId)` - Mark all notifications as read
- `deleteNotification(notificationId)` - Delete a notification
- `deleteAllNotifications(userId)` - Delete all notifications
- `subscribeToNotifications(userId, callback)` - Subscribe to real-time updates
- `getNotificationStats(userId)` - Get notification statistics
- `bulkCreateNotifications(notifications)` - Create multiple notifications
- `notifyAllManagers(notification)` - Notify all managers
- `notifyUser(userId, title, message, options)` - Quick notification helper

### Settings Service Functions

- `getUserSettings(userId)` - Get user settings
- `createDefaultSettings(userId)` - Create default settings
- `updateUserSettings(userId, updates)` - Update settings
- `updateNotificationPreferences(userId, preferences)` - Update notification prefs
- `updateDisplayPreferences(userId, preferences)` - Update display prefs
- `updatePrivacySettings(userId, settings)` - Update privacy settings
- `updateWorkPreferences(userId, preferences)` - Update work prefs
- `resetToDefault(userId)` - Reset to default settings
- `exportSettings(userId)` - Export settings as JSON
- `importSettings(userId, settingsJson)` - Import settings from JSON
- `getTimezones()` - Get available timezones
- `getAvailableLanguages()` - Get supported languages
- `getAvailableThemes()` - Get available themes
- `getDateFormats()` - Get date format options
- `getTimeFormats()` - Get time format options

## Troubleshooting

### Notifications Not Appearing

1. **Check Database Connection**: Ensure Supabase is properly configured
2. **Verify Migration**: Confirm the migration ran successfully
3. **Check Real-time Subscription**: Ensure real-time is enabled in Supabase project settings
4. **Browser Console**: Check for JavaScript errors in the browser console

### Desktop Notifications Not Working

1. **Permission**: Ensure browser notification permission is granted
2. **HTTPS**: Desktop notifications only work on HTTPS (or localhost)
3. **Browser Support**: Verify the browser supports the Notification API
4. **Settings**: Check user has enabled desktop notifications in settings

### Settings Not Saving

1. **Authentication**: Verify user is authenticated
2. **Permissions**: Check user has permission to update settings
3. **Validation**: Ensure settings data passes validation
4. **Network**: Check network connectivity to Supabase

## Best Practices

1. **Notification Frequency**: Don't overwhelm users with too many notifications
2. **Categorization**: Always set appropriate type and category
3. **Action URLs**: Provide action URLs when relevant for better UX
4. **Expiration**: Set expiration dates for time-sensitive notifications
5. **Cleanup**: Regularly clean up old notifications (use `cleanup_old_notifications()` function)
6. **Testing**: Test real-time updates thoroughly before production
7. **Permissions**: Request notification permissions at appropriate times
8. **Fallbacks**: Always provide fallback UI for when notifications fail

## Future Enhancements

Potential improvements:
- Email notification delivery
- Push notification service integration (FCM, OneSignal)
- Notification templates
- Notification scheduling
- Notification preferences per category
- Rich media notifications (images, actions)
- Notification sound customization
- Do Not Disturb mode
- Notification history archiving

## Support

For issues or questions:
1. Check this documentation
2. Review the code comments in service files
3. Check Supabase logs for errors
4. Review browser console for client-side errors

---

**Last Updated**: December 2024
**Version**: 1.0.0
