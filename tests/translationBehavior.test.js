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
