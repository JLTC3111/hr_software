import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTimeEntryStart } from '../src/utils/timeEntryHelpers.js';

test('history orders same-day shifts by clock-in, independently of insertion order', () => {
  const entries = [
    { id: 'regular', date: '2026-09-28', clock_in: '09:00:00', created_at: '2026-09-29T12:00:00Z' },
    { id: 'overtime', date: '2026-09-28', clock_in: '18:00', created_at: '2026-09-28T20:00:00Z' },
    { id: 'overnight', date: '2026-09-27', clock_in: '22:00', clock_out: '02:00' },
    { id: 'newer', date: '2026-09-29', clockIn: '8:00' },
    { id: 'leave', date: '2026-09-28', clock_in: null },
    { id: 'iso', date: '2026-09-28', clock_in: '2026-09-28T19:30:00' },
  ];
  const descending = [...entries].sort((a, b) => compareTimeEntryStart(b, a)).map((entry) => entry.id);
  assert.deepEqual(descending, ['newer', 'iso', 'overtime', 'regular', 'leave', 'overnight']);
  assert.deepEqual([...entries].sort(compareTimeEntryStart).map((entry) => entry.id), descending.reverse());
});
