/**
 * Browser/OS notifications for the Desktop Notifications setting.
 *
 * Push is the in-app feed. Desktop is the Notification API. They are not the
 * same switch — a toast on the machine only goes out when desktop is on.
 */

const CATEGORY_PREF_KEYS = {
  time_tracking: 'notify_time_tracking',
  performance: 'notify_performance',
  employee: 'notify_employee_updates',
  recruitment: 'notify_recruitment',
  system: 'notify_system',
  general: 'notify_system',
};

export function isNotificationCategoryEnabled(prefs, category) {
  const key = CATEGORY_PREF_KEYS[category] || 'notify_system';
  return prefs?.[key] !== false;
}

/** Whether a live notification should raise an OS/browser toast. */
export function shouldDeliverDesktopNotification(prefs, notification) {
  if (!prefs?.desktop_notifications) return false;
  if (!notification || notification.is_read) return false;
  if (prefs.notification_frequency && prefs.notification_frequency !== 'realtime') {
    return false;
  }
  return isNotificationCategoryEnabled(prefs, notification.category);
}

export function getDesktopNotificationPermission(globalObj = globalThis) {
  const NotificationAPI = globalObj?.Notification;
  if (typeof NotificationAPI !== 'function') return 'unsupported';
  const permission = NotificationAPI.permission;
  if (permission === 'granted' || permission === 'denied' || permission === 'default') {
    return permission;
  }
  return 'unsupported';
}

/** Why a browser toast may be unavailable, independent of the account setting. */
export function getDesktopNotificationEnvironment(globalObj = globalThis) {
  let embedded = false;
  try {
    embedded = Boolean(globalObj.self && globalObj.top && globalObj.self !== globalObj.top);
  } catch {
    embedded = true;
  }

  return {
    permission: getDesktopNotificationPermission(globalObj),
    embedded,
    secure: globalObj.isSecureContext !== false,
  };
}

/**
 * Ask for Notification permission. Must run inside a user gesture the first time.
 * Already-granted and already-denied never show a prompt.
 */
export async function requestDesktopNotificationPermission(globalObj = globalThis) {
  const current = getDesktopNotificationPermission(globalObj);
  if (current !== 'default') {
    return {
      granted: current === 'granted',
      reason: current,
      permission: current,
    };
  }

  const NotificationAPI = globalObj.Notification;
  try {
    const next = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        // Safari still accepts the callback form; Chromium returns a Promise.
        const maybePromise = NotificationAPI.requestPermission((value) => finish(value));
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
    // Closing Chrome's quiet permission prompt resolves to "default". Keep
    // that state retryable instead of reporting that the site was blocked.
    const afterRequest = getDesktopNotificationPermission(globalObj);
    const permission =
      next === 'granted' || next === 'denied' || next === 'default'
        ? next
        : afterRequest === 'unsupported'
          ? 'default'
          : afterRequest;
    return {
      granted: permission === 'granted',
      reason: permission,
      permission,
    };
  } catch {
    return {
      granted: false,
      reason: 'error',
      permission: getDesktopNotificationPermission(globalObj),
    };
  }
}

export function showDesktopNotification(title, options = {}, globalObj = globalThis) {
  if (getDesktopNotificationPermission(globalObj) !== 'granted') return null;
  try {
    return new globalObj.Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch {
    return null;
  }
}
