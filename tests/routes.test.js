import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePostLoginRoute, DEFAULT_AUTHENTICATED_ROUTE } from '../src/config/routes.js';

/*
 * Two code paths race to redirect a user who has just authenticated — the
 * /login route guard and the login screen's own effect — and which one wins
 * depends on render timing. They must not disagree about the destination, so
 * both call this and the answer is pinned here.
 */

test('a remembered location wins', () => {
  assert.equal(resolvePostLoginRoute('/employees'), '/employees');
  assert.equal(resolvePostLoginRoute('/reports?tab=payroll'), '/reports?tab=payroll');
});

test('nothing remembered falls back to the default screen', () => {
  assert.equal(resolvePostLoginRoute(undefined), DEFAULT_AUTHENTICATED_ROUTE);
  assert.equal(resolvePostLoginRoute(null), DEFAULT_AUTHENTICATED_ROUTE);
  assert.equal(resolvePostLoginRoute(''), DEFAULT_AUTHENTICATED_ROUTE);
});

test('it never bounces back to the login screen', () => {
  // Guards the redirect loop: /login remembering /login would never resolve.
  assert.equal(resolvePostLoginRoute('/login'), DEFAULT_AUTHENTICATED_ROUTE);
});
