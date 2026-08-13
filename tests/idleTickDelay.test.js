import test from 'node:test';
import assert from 'node:assert/strict';
import { idleTickDelay } from '../src/hooks/useIdleLogout.js';

/*
 * A countdown is only honest if the loop behind it looks often enough.
 *
 * The hook derives its lazy poll from the timeout — 30s for the 15-minute
 * production setting — which is fine for "log out eventually" and useless for
 * "60, 59, 58...": the warning could arrive with half its seconds already
 * spent, and the sign-out could land 30s after the display hit zero. These
 * cases pin the two guarantees the modal relies on.
 */

const IDLE_WINDOW = 15 * 60 * 1000;
const WARN_BEFORE = 60 * 1000;
const bounds = {
  warnThreshold: IDLE_WINDOW - WARN_BEFORE, // 14 minutes
  coarseIntervalMs: 30 * 1000,
};

test('far from the deadline it sleeps the coarse interval', () => {
  assert.equal(idleTickDelay(0, bounds), 30 * 1000);
  assert.equal(idleTickDelay(5 * 60 * 1000, bounds), 30 * 1000);
});

test('it lands exactly on the warning threshold, never past it', () => {
  // 10s short of the threshold: sleeping a full interval would open the warning
  // with 40 of its 60 seconds already gone.
  assert.equal(idleTickDelay(bounds.warnThreshold - 10_000, bounds), 10_000);
  assert.equal(idleTickDelay(bounds.warnThreshold - 1_000, bounds), 1_000);

  // Whatever the remaining gap, the tick never overshoots into the window.
  for (const gap of [45_000, 30_001, 30_000, 29_999, 500]) {
    const delay = idleTickDelay(bounds.warnThreshold - gap, bounds);
    assert.ok(delay <= Math.max(gap, 250), `overshot with ${gap}ms to go`);
  }
});

test('inside the warning window it ticks every second', () => {
  assert.equal(idleTickDelay(bounds.warnThreshold, bounds), 1000);
  assert.equal(idleTickDelay(bounds.warnThreshold + 30_000, bounds), 1000);
  // Past the deadline too — a retry after a failed sign-out must stay prompt.
  assert.equal(idleTickDelay(IDLE_WINDOW + 60_000, bounds), 1000);
});

test('it never busy-loops', () => {
  // A gap of a few milliseconds must not schedule a 3ms timer.
  assert.ok(idleTickDelay(bounds.warnThreshold - 3, bounds) >= 250);
});
