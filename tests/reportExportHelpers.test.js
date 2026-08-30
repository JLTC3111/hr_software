import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPdfReportLayout,
  getPdfProfileImageSource,
  getTaskDurationDays,
  PDF_TOKENS,
} from '../src/utils/reportExportHelpers.js';

const now = new Date(2026, 7, 28); // 28 Aug 2026, local

test('logged-after-the-fact completed task uses start→due and start→completion', () => {
  const duration = getTaskDurationDays({
    created_at: new Date(2026, 7, 28),
    start_date: '2026-08-14',
    due_date: '2026-08-22',
    completion_date: '2026-08-21',
    status: 'completed',
    updated_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: 8, actual: 7, variance: -1 });
});

test('created_at is ignored when start_date is missing', () => {
  const duration = getTaskDurationDays({
    created_at: new Date(2026, 7, 20),
    due_date: '2026-08-27',
    status: 'completed',
    completion_date: '2026-08-21',
    updated_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: null, actual: null, variance: null });
});

test('open task with a start measures actual days through today', () => {
  const duration = getTaskDurationDays({
    start_date: '2026-08-20',
    due_date: '2026-08-30',
    status: 'in_progress',
    created_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: 10, actual: 8, variance: -2 });
});

test('same-day start and due still counts as at least one estimated day', () => {
  const duration = getTaskDurationDays({
    start_date: '2026-08-28',
    due_date: '2026-08-28',
    status: 'in-progress',
  }, now);

  assert.equal(duration.estimated, 1);
  assert.equal(duration.actual, 0);
});

test('pending task with no start date cannot be measured', () => {
  const duration = getTaskDurationDays({
    due_date: '2026-08-30',
    status: 'pending',
    created_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: null, actual: null, variance: null });
});

test('single-employee PDF uses the current profile photo', () => {
  const photo = 'data:image/png;base64,current-photo';
  assert.equal(getPdfProfileImageSource([{ id: 7, photo }]), photo);
});

test('single-employee PDF can use the linked user avatar', () => {
  const avatar = 'data:image/jpeg;base64,linked-avatar';
  assert.equal(
    getPdfProfileImageSource([{ id: 7, hr_user: { avatar_url: avatar } }]),
    avatar
  );
});

test('multi-employee PDF always uses the generic employee SVG', () => {
  const source = getPdfProfileImageSource([
    { id: 7, photo: 'data:image/png;base64,first-photo' },
    { id: 8, photo: 'data:image/png;base64,second-photo' },
  ]);

  assert.match(source, /generic-employee\.svg$/);
});

test('employee without a photo falls back to the generic employee SVG', () => {
  assert.match(getPdfProfileImageSource([{ id: 7, photo: null }]), /generic-employee\.svg$/);
});

test('PDF masthead reserves a right-aligned square for the profile image', () => {
  const images = [];
  const rectangles = [];
  const fittedWidths = [];
  const doc = {
    addImage: (...args) => images.push(args),
    rect: (...args) => rectangles.push(args),
    setDrawColor: () => {},
    setFontSize: () => {},
    setLineWidth: () => {},
    setTextColor: () => {},
  };

  const layout = createPdfReportLayout({
    doc,
    pageWidth: 210,
    pageHeight: 297,
    drawText: () => {},
    measureText: () => 0,
    fitText: (text, maxWidth) => {
      fittedWidths.push(maxWidth);
      return text;
    },
  });

  layout.titleBlock({
    title: 'HR PERFORMANCE REPORT',
    metaLines: ['Generated: now'],
    profileImage: { dataUrl: 'data:image/png;base64,profile', width: 384, height: 384 },
  });

  const expectedLeft = 210 - PDF_TOKENS.margin - PDF_TOKENS.profileSize;
  assert.equal(images.length, 1);
  assert.deepEqual(images[0].slice(2, 6), [expectedLeft, 18, PDF_TOKENS.profileSize, PDF_TOKENS.profileSize]);
  assert.deepEqual(rectangles[0], [expectedLeft, 18, PDF_TOKENS.profileSize, PDF_TOKENS.profileSize]);
  assert.equal(
    fittedWidths[0],
    210 - (PDF_TOKENS.margin * 2) - PDF_TOKENS.profileSize - PDF_TOKENS.profileGap
  );
  assert.ok(layout.y >= 18 + PDF_TOKENS.profileSize);
});
