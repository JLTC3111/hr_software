import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDesktopNotificationEnvironment,
  getDesktopNotificationPermission,
  isNotificationCategoryEnabled,
  requestDesktopNotificationPermission,
  shouldDeliverDesktopNotification,
  showDesktopNotification,
} from '../src/utils/desktopNotifications.js';

const prefs = (overrides = {}) => ({
  desktop_notifications: true,
  notification_frequency: 'realtime',
  notify_time_tracking: true,
  notify_performance: true,
  notify_employee_updates: true,
  notify_recruitment: true,
  notify_system: true,
  ...overrides,
});

const unread = (overrides = {}) => ({
  id: 'n1',
  title: 'Clock out missing',
  message: 'Yesterday is still open',
  category: 'time_tracking',
  is_read: false,
  ...overrides,
});

test('desktop toasts stay off unless the desktop setting is on', () => {
  assert.equal(
    shouldDeliverDesktopNotification(prefs({ desktop_notifications: false }), unread()),
    false
  );
  assert.equal(
    shouldDeliverDesktopNotification(prefs({ desktop_notifications: true }), unread()),
    true
  );
});

test('push-style in-app prefs do not raise a desktop toast', () => {
  assert.equal(
    shouldDeliverDesktopNotification(
      prefs({ desktop_notifications: false, push_notifications: true }),
      unread()
    ),
    false
  );
});

test('digests and muted topics never raise a desktop toast', () => {
  assert.equal(
    shouldDeliverDesktopNotification(prefs({ notification_frequency: 'daily' }), unread()),
    false
  );
  assert.equal(
    shouldDeliverDesktopNotification(prefs({ notify_time_tracking: false }), unread()),
    false
  );
  assert.equal(
    shouldDeliverDesktopNotification(prefs(), unread({ is_read: true })),
    false
  );
});

test('unknown categories fall back to the system topic switch', () => {
  assert.equal(isNotificationCategoryEnabled(prefs({ notify_system: false }), 'general'), false);
  assert.equal(
    shouldDeliverDesktopNotification(prefs({ notify_system: false }), unread({ category: 'payroll' })),
    false
  );
});

test('permission is unsupported when the Notification API is missing', () => {
  assert.equal(getDesktopNotificationPermission({}), 'unsupported');
});

test('an embedded window is reported separately from a blocked site', () => {
  const nested = getDesktopNotificationEnvironment({
    Notification: Object.assign(function Notification() {}, { permission: 'denied' }),
    self: { id: 'frame' },
    top: { id: 'page' },
    isSecureContext: true,
  });
  assert.equal(nested.embedded, true);
  assert.equal(nested.permission, 'denied');
  assert.equal(nested.secure, true);
});

function mockNotification({ permission, requestPermission }) {
  function Notification() {}
  Notification.permission = permission;
  Notification.requestPermission = requestPermission;
  return { Notification };
}

test('an already-denied permission is not asked again', async () => {
  const result = await requestDesktopNotificationPermission(mockNotification({
    permission: 'denied',
    requestPermission: async () => 'granted',
  }));
  assert.deepEqual(result, { granted: false, reason: 'denied', permission: 'denied' });
});

test('an already-granted permission is treated as success', async () => {
  const result = await requestDesktopNotificationPermission(mockNotification({
    permission: 'granted',
    requestPermission: async () => 'denied',
  }));
  assert.deepEqual(result, { granted: true, reason: 'granted', permission: 'granted' });
});

test('a first-time prompt records grant and denial', async () => {
  const granted = await requestDesktopNotificationPermission(mockNotification({
    permission: 'default',
    requestPermission: async () => 'granted',
  }));
  assert.equal(granted.granted, true);
  assert.equal(granted.permission, 'granted');

  const denied = await requestDesktopNotificationPermission(mockNotification({
    permission: 'default',
    requestPermission: async () => 'denied',
  }));
  assert.equal(denied.granted, false);
  assert.equal(denied.reason, 'denied');
});

test('dismissing the permission prompt remains retryable', async () => {
  let requests = 0;
  const browser = mockNotification({
    permission: 'default',
    requestPermission: async () => {
      requests += 1;
      return 'default';
    },
  });

  const first = await requestDesktopNotificationPermission(browser);
  const second = await requestDesktopNotificationPermission(browser);

  assert.deepEqual(first, { granted: false, reason: 'default', permission: 'default' });
  assert.deepEqual(second, { granted: false, reason: 'default', permission: 'default' });
  assert.equal(requests, 2);
});

test('Safari callback-style requestPermission is accepted', async () => {
  const result = await requestDesktopNotificationPermission(mockNotification({
    permission: 'default',
    requestPermission: (callback) => {
      callback('granted');
    },
  }));
  assert.equal(result.granted, true);
});

test('a toast is only constructed when permission is granted', () => {
  const created = [];
  function Notification(title, options) {
    created.push({ title, options });
  }
  Notification.permission = 'granted';

  const toast = showDesktopNotification('Hello', { body: 'World' }, { Notification });
  assert.equal(created.length, 1);
  assert.equal(created[0].title, 'Hello');
  assert.equal(created[0].options.body, 'World');
  assert.ok(toast);

  Notification.permission = 'denied';
  assert.equal(showDesktopNotification('Nope', {}, { Notification }), null);
});
