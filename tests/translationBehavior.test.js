import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  localizeSystemNotificationActionLabel,
  localizeSystemNotificationMessage,
  localizeSystemNotificationTitle,
} from '../src/utils/notificationTranslation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (filename) => fs.readFileSync(path.join(ROOT, filename), 'utf8');
const fakeT = (key, fallback) => `translated:${key}:${fallback}`;

test('only fixed system notification copy is sent through the UI catalog', () => {
  assert.equal(
    localizeSystemNotificationTitle('Pending Approvals', fakeT),
    'translated:notifications.pendingApprovals:Pending Approvals'
  );
  assert.equal(
    localizeSystemNotificationActionLabel('Review Now', fakeT),
    'translated:notifications.reviewNow:Review Now'
  );
  assert.equal(
    localizeSystemNotificationMessage('You have 2 time entries awaiting approval', fakeT),
    'translated:notifications.timeEntriesAwaiting:You have 2 time entries awaiting approval'
      .replace('{0}', '2')
  );

  const authored = 'Please review: You have 2 time entries awaiting approval for my team';
  assert.equal(localizeSystemNotificationTitle(authored, fakeT), authored);
  assert.equal(localizeSystemNotificationMessage(authored, fakeT), authored);
  assert.equal(localizeSystemNotificationActionLabel(authored, fakeT), authored);
});

test('Personal Goals requests exact Translation Studio records in list and detail views', () => {
  const personalGoals = source('src/components/personalGoals.jsx');
  const goalRecords = personalGoals.match(/entityType:\s*['"]goal['"]/g) || [];
  const titleFields = personalGoals.match(/field:\s*['"]title['"]/g) || [];
  const descriptionFields = personalGoals.match(/field:\s*['"]description['"]/g) || [];

  assert.ok(goalRecords.length >= 4, 'goal list and detail must both provide exact record metadata');
  assert.ok(titleFields.length >= 2, 'goal title must be translated in list and detail');
  assert.ok(descriptionFields.length >= 2, 'goal description must be translated in list and detail');

  const studioService = source('src/services/ugcTranslationService.js');
  assert.match(studioService, /goal:\s*\{[\s\S]*?table:\s*['"]performance_goals['"]/);
  assert.match(studioService, /fields:\s*\[['"]title['"],\s*['"]description['"],\s*['"]notes['"],\s*['"]success_criteria['"]\]/);
});

test('Task Review uses the Translation Studio review entity identifier', () => {
  const taskReview = source('src/components/taskReview.jsx');
  assert.match(taskReview, /entityType:\s*['"]review['"]/);
  assert.doesNotMatch(taskReview, /entityType:\s*['"]performance_review['"]/);
});

test('Policy Controls keeps translatable queue copy out of state snapshots', () => {
  const policyControls = source('src/components/policyControls.jsx');
  assert.match(policyControls, /const INITIAL_QUEUE = \[/);
  assert.match(policyControls, /name:\s*message\(['"]policyControls\./);
  assert.doesNotMatch(policyControls, /useState\(\[[\s\S]*?name:\s*t\(['"]policyControls\./);
});

test('Policy Controls passes the translator to its toggle formatter', () => {
  const policyControls = source('src/components/policyControls.jsx');
  assert.match(policyControls, /fmtOnOff\(on,\s*language,\s*t\)/);
  assert.match(policyControls, /language=\{currentLanguage\}/);
  assert.doesNotMatch(policyControls, /fmtOnOff\(on,\s*t\)/);
});

test('Personal Goals review-due ticker formats the close date in the UI language', () => {
  const personalGoals = source('src/components/personalGoals.jsx');
  assert.match(personalGoals, /formatDate\(closeDate,\s*currentLanguage/);
  assert.doesNotMatch(personalGoals, /toLocaleDateString\(undefined/);
});

test('segmented controls wrap instead of overflowing their panel', () => {
  const industry = source('src/components/ui/industry.jsx');
  assert.match(industry, /flexWrap:\s*['"]wrap['"]/);
  assert.match(industry, /maxWidth:\s*['"]100%['"]/);
});

test('header replaces band actions with a kebab below the desktop breakpoint', () => {
  const header = source('src/components/header.jsx');
  const menu = source('src/components/MobileHeaderMenu.jsx');
  assert.match(header, /import MobileHeaderMenu/);
  assert.match(header, /isDesktop \? \(/);
  assert.match(menu, /MoreVertical/);
  assert.doesNotMatch(menu, /className=.*lg:hidden/);
});

test('Personal Goals collapses overflow actions into a kebab below desktop', () => {
  const personalGoals = source('src/components/personalGoals.jsx');
  assert.match(personalGoals, /useMinWidth\(1024\)/);
  assert.match(personalGoals, /<MoreMenu\b/);
});

test('Task Listing uses the wrapping Seg control for filter chips', () => {
  const taskListing = source('src/components/taskListing.jsx');
  assert.match(taskListing, /<Seg\b/);
});

test('Reports period labels do not include romanization glosses', async () => {
  for (const locale of ['ru', 'jp', 'kr']) {
    const [{ default: additions }, { default: nested }] = await Promise.all([
      import(`../src/translations/additions/${locale}.js`),
      import(`../src/translations/${locale}.js`),
    ]);
    for (const value of [
      additions['reports.lastMonth'],
      nested.reports.lastMonth,
      nested.reports.lastWeek,
      nested.reports.lastQuarter,
      nested.reports.lastYear,
    ]) {
      assert.doesNotMatch(value, /\([A-Za-z]/, `${locale} still has a romanization gloss: ${value}`);
    }
  }
});
