import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveScreenValues, applyScreenPatch } from '../src/hooks/useScreenNavigation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const SPEC = {
  tab: {
    key: 'tab',
    fallback: null,
    isValid: (value) => ['open', 'mine', 'overdue', 'closed'].includes(value),
  },
  task: { key: 'task', fallback: null },
};

/* ------------------------------------------------------------------ *
 * Reading a URL
 * ------------------------------------------------------------------ */

test('a bare screen URL reports no tab and no opened task', () => {
  const values = resolveScreenValues(SPEC, new URLSearchParams(''));
  assert.deepEqual(values, { tab: null, task: null });
});

test('a deep link carries both the tab and the opened task', () => {
  const values = resolveScreenValues(SPEC, new URLSearchParams('?tab=overdue&task=42'));
  assert.deepEqual(values, { tab: 'overdue', task: '42' });
});

test('a tab the screen cannot render reads as absent rather than filtering to nothing', () => {
  for (const query of ['?tab=nonsense', '?tab=', '?tab=OPEN']) {
    assert.equal(resolveScreenValues(SPEC, new URLSearchParams(query)).tab, null, query);
  }
});

test('a fallback stands in for a missing value', () => {
  const spec = { tab: { key: 'tab', fallback: 'open' } };
  assert.equal(resolveScreenValues(spec, new URLSearchParams('')).tab, 'open');
  assert.equal(resolveScreenValues(spec, new URLSearchParams('?tab=closed')).tab, 'closed');
});

/* ------------------------------------------------------------------ *
 * Writing a URL
 * ------------------------------------------------------------------ */

test('opening a task keeps the tab it was opened from', () => {
  const next = applyScreenPatch(SPEC, new URLSearchParams('?tab=overdue'), { task: 7 });
  assert.equal(next.get('tab'), 'overdue');
  assert.equal(next.get('task'), '7');
});

test('closing the detail sheet drops the parameter instead of blanking it', () => {
  const next = applyScreenPatch(SPEC, new URLSearchParams('?tab=closed&task=7'), { task: null });
  assert.equal(next.has('task'), false);
  assert.equal(next.toString(), 'tab=closed');
});

test('tab and opened task can move in one call, because setSearchParams does not queue', () => {
  const next = applyScreenPatch(
    SPEC,
    new URLSearchParams('?tab=closed&task=7'),
    { task: null, tab: 'open' },
  );
  assert.equal(next.get('tab'), 'open');
  assert.equal(next.has('task'), false);
});

test('query state the screen does not own survives a navigation', () => {
  const next = applyScreenPatch(SPEC, new URLSearchParams('?ref=email&tab=mine'), { task: 3 });
  assert.equal(next.get('ref'), 'email');
});

test('a patch key outside the spec cannot write to the URL', () => {
  const next = applyScreenPatch(SPEC, new URLSearchParams(''), { nope: 'x' });
  assert.equal(next.toString(), '');
});

test('patching does not mutate the params it was handed', () => {
  const previous = new URLSearchParams('?tab=open');
  applyScreenPatch(SPEC, previous, { task: 9, tab: 'closed' });
  assert.equal(previous.toString(), 'tab=open');
});

/* ------------------------------------------------------------------ *
 * Task Listing wiring
 * ------------------------------------------------------------------ */

test('Task Listing holds its tab and opened task in the URL, not in useState', () => {
  const taskListing = source('src/components/taskListing.jsx');

  assert.match(taskListing, /useScreenNavigation\(TASK_LISTING_NAV\)/);
  assert.match(taskListing, /const openTaskId = nav\.task/);

  // The old component state is what made Back leave the screen and a reload
  // land on the ledger. Neither may come back.
  assert.doesNotMatch(taskListing, /useState\(\s*'open'\s*\)/);
  assert.doesNotMatch(taskListing, /setOpenTaskId/);
});

test('opening a task pushes and the screen correcting itself replaces', () => {
  const taskListing = source('src/components/taskListing.jsx');

  // Opening a row is a navigation: Back must return to the ledger.
  assert.match(taskListing, /const openTask = useCallback\(\(id\) => \{[\s\S]*?go\(\{ task: id \}\);/);

  // Choosing the tab for the viewer, and clearing a dead link, are corrections
  // rather than places, so they must not become Back steps.
  assert.match(taskListing, /go\(\{ tab: 'closed' \}, \{ replace: true \}\)/);
  assert.match(taskListing, /go\(\{ task: null \}, \{ replace: true \}\)/);
});

/* ------------------------------------------------------------------ *
 * Task Review wiring
 * ------------------------------------------------------------------ */

test('Task Review holds its cycle, scope and opened sheet in the URL', () => {
  const taskReview = source('src/components/taskReview.jsx');

  assert.match(taskReview, /useScreenNavigation\(TASK_REVIEW_NAV\)/);
  assert.match(taskReview, /const selectedPeriod = nav\.cycle \?\? liveCycle/);
  assert.match(taskReview, /const segment = nav\.scope \?\? DEFAULT_SCOPE/);

  for (const setter of ['setOpenReview', 'setSelectedPeriod', 'setPeriodTouched', 'setSegment']) {
    assert.doesNotMatch(taskReview, new RegExp(`\\b${setter}\\b`), setter);
  }
});

test('the review sheet reads the live row, not a snapshot from when it opened', () => {
  const taskReview = source('src/components/taskReview.jsx');

  // Holding the row object meant signing off left stale figures on screen.
  assert.match(taskReview, /const openReview = useMemo\(\s*\(\) => \(nav\.review \? cycleRows\.find/);
  assert.doesNotMatch(taskReview, /openRow\(row\.review\)/);
  assert.match(taskReview, /const openRow = useCallback\(\(row\) => \{ go\(\{ review: row\.id \}\); \}/);
});

test('Task Review pushes what the viewer chose and replaces what it corrected', () => {
  const taskReview = source('src/components/taskReview.jsx');

  // Picking a cycle, a scope or a person is a place.
  assert.match(taskReview, /const selectPeriod = useCallback\(\(value\) => \{ go\(\{ cycle: value \}\); \}/);
  assert.match(taskReview, /const selectSegment = useCallback\(\(value\) => \{ go\(\{ scope: value \}\); \}/);

  // Resolving the cycle, dropping an unreachable scope, clearing a dead link
  // and closing a sheet the viewer just signed off are all corrections.
  assert.match(taskReview, /go\(\{ cycle: resolved \}, \{ replace: true \}\)/);
  assert.match(taskReview, /go\(\{ scope: null \}, \{ replace: true \}\)/);
  assert.match(taskReview, /go\(\{ review: null \}, \{ replace: true \}\)/);
  assert.match(taskReview, /closeReview\(\{ replace: true \}\)/);
});

test('Task Review does not correct URL state before it has data to judge it', () => {
  const taskReview = source('src/components/taskReview.jsx');

  // Resolving the cycle from an empty fetch would stamp the live quarter into
  // the URL and, being explicit, stop the real answer from ever landing.
  assert.match(taskReview, /if \(periodTouched \|\| loading \|\| fetchError \|\| periodOptions\.length === 0\) return;/);

  // The scope comes from the directory, which arrives separately from reviews.
  assert.match(taskReview, /if \(segment === DEFAULT_SCOPE \|\| activeEmployees\.length === 0\) return;/);

  // cycleRows is empty mid-fetch, which is not the same as the review being gone.
  assert.match(taskReview, /if \(loading \|\| fetchError \|\| !nav\.review \|\| openReview\) return;/);
});

test('a cycle key that is not a quarter is refused', () => {
  const spec = { cycle: { key: 'cycle', fallback: null, isValid: (v) => /^Q[1-4]-\d{4}$/.test(v) } };

  assert.equal(resolveScreenValues(spec, new URLSearchParams('?cycle=Q3-2026')).cycle, 'Q3-2026');
  for (const bad of ['?cycle=Q5-2026', '?cycle=2026-Q3', '?cycle=lastyear', '?cycle=']) {
    assert.equal(resolveScreenValues(spec, new URLSearchParams(bad)).cycle, null, bad);
  }
});
