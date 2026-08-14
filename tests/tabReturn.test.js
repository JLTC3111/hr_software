import test from 'node:test';
import assert from 'node:assert/strict';
import { isRepeatedSessionSignIn } from '../src/utils/authEvents.js';
import { isRefreshDue } from '../src/hooks/useVisibilityRefresh.js';

test('tab-focus SIGNED_IN with the active token is a session replay', () => {
  assert.equal(
    isRepeatedSessionSignIn('active-token', { access_token: 'active-token' }),
    true
  );
});

test('a genuinely new session is not classified as a tab-focus replay', () => {
  assert.equal(
    isRepeatedSessionSignIn('active-token', { access_token: 'new-token' }),
    false
  );
  assert.equal(isRepeatedSessionSignIn(null, { access_token: 'new-token' }), false);
});

test('a one-second tab switch does not bypass the stale window', () => {
  const lastRefresh = 1_000_000;
  const fifteenMinutes = 15 * 60 * 1000;

  assert.equal(isRefreshDue(lastRefresh, fifteenMinutes, lastRefresh + 1000), false);
  assert.equal(isRefreshDue(lastRefresh, fifteenMinutes, lastRefresh + fifteenMinutes), true);
});

test('coming back online can still force an immediate refresh', () => {
  const lastRefresh = 1_000_000;
  const fifteenMinutes = 15 * 60 * 1000;

  assert.equal(
    isRefreshDue(lastRefresh, fifteenMinutes, lastRefresh + 1000, true),
    true
  );
});
