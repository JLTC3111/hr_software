import test from 'node:test';
import assert from 'node:assert/strict';
import { minutesToClock, localDate, dueBreakReminder, setBreakState } from '../src/utils/punchSession.js';

const date = time => new Date(`2026-10-08T${time}`);
const session = { date: localDate(date('09:00:00')), clockIn: 540, breaks: [] };

test('punch times carry rounded minutes into the next hour', () => {
  assert.equal(minutesToClock(17 * 60 + 59.25), '17:59');
  assert.equal(minutesToClock(17 * 60 + 59.5), '18:00');
  assert.equal(minutesToClock(17 * 60 + 59.75), '18:00');
  assert.equal(minutesToClock(23 * 60 + 59.75), '00:00');
});

test('lunch reminders require an open punch for today and occur in the lunch window', () => {
  assert.equal(dueBreakReminder(null, date('12:00:00')), null);
  assert.equal(dueBreakReminder({ ...session, date: '2026-10-07' }, date('12:00:00')), null);
  assert.equal(dueBreakReminder(session, date('11:59:59')), null);
  assert.equal(dueBreakReminder(session, date('12:00:00')), 'start');
  assert.equal(dueBreakReminder(session, date('12:59:59')), 'start');
  assert.equal(dueBreakReminder(session, date('13:00:00')), null);
});

test('one break action pauses then resumes the existing shift without duplicate intervals', () => {
  const start = setBreakState(session, 720, true);
  assert.equal(start.clockIn, 540);
  assert.deepEqual(start.breaks, [{ start: 720, end: null }]);
  assert.equal(setBreakState(start, 721, true), start);
  assert.equal(dueBreakReminder(start, date('12:30:00')), null);
  assert.equal(dueBreakReminder(start, date('13:00:00')), 'resume');
  const resume = setBreakState(start, 780, false);
  assert.deepEqual(resume.breaks, [{ start: 720, end: 780 }]);
  assert.equal(setBreakState(resume, 781, false), resume);
  assert.equal(dueBreakReminder(resume, date('12:45:00')), null);
  assert.equal(dueBreakReminder(resume, date('13:15:00')), null);
});

test('an earlier coffee break does not suppress lunch and a later break is not a lunch return prompt', () => {
  assert.equal(dueBreakReminder({ ...session, breaks: [{ start: 630, end: 645 }] }, date('12:00:00')), 'start');
  assert.equal(dueBreakReminder({ ...session, breaks: [{ start: 850, end: null }] }, date('14:30:00')), null);
});

test('break transitions cannot end before the break started or alter the original session', () => {
  const started = setBreakState(session, 720, true);
  const ended = setBreakState(started, 719, false);
  assert.equal(ended.breaks[0].end, 720);
  assert.deepEqual(session.breaks, []);
  assert.equal(started.breaks[0].end, null);
});
