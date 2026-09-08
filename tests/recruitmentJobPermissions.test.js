import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const canManageRecruitmentOf = (permissions, marker) => {
  const index = permissions.indexOf(marker);
  assert.ok(index >= 0, marker);
  const match = permissions.slice(index, index + 500).match(/canManageRecruitment:\s*(true|false)/);
  assert.ok(match, marker);
  return match[1] === 'true';
};

test('admin and manager may manage recruitment; employee and contractor may not', () => {
  const permissions = source('src/config/supabaseClient.js');
  assert.equal(canManageRecruitmentOf(permissions, "'admin': {"), true);
  assert.equal(canManageRecruitmentOf(permissions, "'manager': {"), true);
  assert.equal(canManageRecruitmentOf(permissions, '[UserRoles.EMPLOYEE]'), false);
  assert.equal(canManageRecruitmentOf(permissions, '[UserRoles.CONTRACTOR]'), false);
});

test('Jobs post, edit and delete are gated on canManageRecruitment', () => {
  const recruitment = source('src/components/recruitment.jsx');
  assert.match(recruitment, /checkPermission\('canManageRecruitment'\)/);
  assert.match(recruitment, /if \(!canManageJobs\) return;/);
  assert.match(recruitment, /jobModal && canManageJobs && \(/);
  assert.match(recruitment, /\{canManageJobs && \(\s*<Btn ind=\{ind\} variant="primary" onClick=\{\(\) => setJobModal\('new'\)\}/);
});
