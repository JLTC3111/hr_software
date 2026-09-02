export const formatHours = (value, decimals = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return (0).toFixed(decimals);
  const factor = 10 ** decimals;
  return (Math.round(num * factor) / factor).toFixed(decimals);
};

const DAY_MS = 86400000;

const startOfLocalDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseStamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  const date = dateOnly
    ? new Date(`${dateOnly[1]}T00:00:00`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (from, to) =>
  Math.round((startOfLocalDay(to) - startOfLocalDay(from)) / DAY_MS);

const isTaskClosed = (task) =>
  String(task?.status ?? '').toLowerCase().replace(/_/g, '-') === 'completed';

/**
 * Calendar days a task was given (start → due) vs days it actually took
 * (start → completion, or → today if still open). created_at is when the row
 * was typed in — often after the work was already done — so it is not a start.
 */
export const getTaskDurationDays = (task, now = new Date()) => {
  const startedAt = parseStamp(task?.start_date);
  const dueAt = parseStamp(task?.due_date);
  const completedAt = parseStamp(task?.completion_date || task?.completed_at);

  const estimated = startedAt && dueAt ? Math.max(1, daysBetween(startedAt, dueAt)) : null;

  let actual = null;
  if (startedAt && completedAt) {
    actual = Math.max(0, daysBetween(startedAt, completedAt));
  } else if (startedAt && !isTaskClosed(task)) {
    actual = Math.max(0, daysBetween(startedAt, now));
  }

  const variance = estimated != null && actual != null ? actual - estimated : null;
  return { estimated, actual, variance };
};

/**
 * The export carries exactly the record types the scope panel has ticked, so an
 * unticked type is emptied rather than filtered — the file then contains no
 * section for it at all.
 */
export const filterExportSnapshotByScope = (scope = {}, snapshot = {}) => ({
  timeEntries: scope.timeEntries ? (snapshot.timeEntries || []) : [],
  tasks: scope.tasks ? (snapshot.tasks || []) : [],
  goals: scope.goals ? (snapshot.goals || []) : [],
  leave: scope.leave ? (snapshot.leave || []) : [],
  employees: snapshot.employees || [],
});

/** Mon–Fri days in an inclusive YYYY-MM-DD range. */
export const countWorkingDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const aggregateCounts = (items, field) => {
  const counts = {};
  (items || []).forEach((item) => {
    const key = item?.[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};

export const aggregateHoursByType = (timeEntries) => {
  const totals = {};
  (timeEntries || []).forEach((entry) => {
    const type = entry.hour_type || entry.hourType || 'unknown';
    totals[type] = (totals[type] || 0) + (Number(entry.hours) || 0);
  });
  Object.keys(totals).forEach((type) => {
    totals[type] = Number(formatHours(totals[type]));
  });
  return totals;
};

export const computeExportStats = (timeEntries = [], tasks = [], goals = [], leave = []) => {
  const totalHours = timeEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  return {
    totalRecords: timeEntries.length + tasks.length + goals.length + leave.length,
    timeEntriesCount: timeEntries.length,
    tasksCount: tasks.length,
    goalsCount: goals.length,
    leaveCount: leave.length,
    totalHours: formatHours(totalHours),
    approvedTime: timeEntries.filter((entry) => entry.status === 'approved').length,
    pendingTime: timeEntries.filter((entry) => entry.status === 'pending').length,
    completedTasks: tasks.filter((task) => task.status === 'completed').length,
    inProgressTasks: tasks.filter((task) => task.status === 'in_progress' || task.status === 'in-progress').length,
    achievedGoals: goals.filter((goal) => goal.status === 'completed').length,
    inProgressGoals: goals.filter((goal) => goal.status === 'in_progress' || goal.status === 'in-progress').length,
    averageGoalProgress: goals.length
      ? Math.round(goals.reduce((sum, goal) => sum + (Number(goal.progress) || 0), 0) / goals.length)
      : 0,
    taskCompletionRate: tasks.length
      ? Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100)
      : 0
  };
};

export const computeEmployeePerformance = (employee, timeEntries = [], tasks = [], goals = []) => {
  const employeeTimeEntries = timeEntries.filter((entry) => String(entry.employee_id) === String(employee.id));
  const employeeTasks = tasks.filter((task) => String(task.employee_id) === String(employee.id));
  const employeeGoals = goals.filter((goal) => String(goal.employee_id) === String(employee.id));

  const totalHours = employeeTimeEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const approvedEntries = employeeTimeEntries.filter((entry) => entry.status === 'approved').length;
  const completedTasks = employeeTasks.filter((task) => task.status === 'completed').length;
  const taskCompletionRate = employeeTasks.length ? (completedTasks / employeeTasks.length) * 100 : 0;
  const avgGoalProgress = employeeGoals.length
    ? employeeGoals.reduce((sum, goal) => sum + (goal.status === 'completed' ? 100 : (Number(goal.progress) || 0)), 0) / employeeGoals.length
    : 0;
  const timeScore = employeeTimeEntries.length ? (approvedEntries / employeeTimeEntries.length) * 100 : 0;
  const overallScore = ((timeScore + taskCompletionRate + avgGoalProgress) / 3).toFixed(1);

  return {
    totalHours,
    timeEntriesCount: employeeTimeEntries.length,
    tasksCount: employeeTasks.length,
    completedTasks,
    taskCompletionRate: taskCompletionRate.toFixed(1),
    goalsCount: employeeGoals.length,
    avgGoalProgress: avgGoalProgress.toFixed(1),
    overallScore
  };
};

export const escapeCsvCell = (value) => {
  const stringValue = value == null ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildCombinedCsvContent = ({
  metadataRows = [],
  sections = []
}) => {
  const lines = [...metadataRows, ''];

  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(escapeCsvCell(section.title));
    if (section.headers?.length) {
      lines.push(section.headers.map(escapeCsvCell).join(','));
    }
    section.rows.forEach((row) => {
      lines.push(row.map(escapeCsvCell).join(','));
    });
  });

  return lines.join('\n');
};

/**
 * PDF report design tokens: one accent + one ink, zero corner radius, 2px rules.
 * Millimetres, matching the jsPDF unit used by the report ('p', 'mm', 'a4').
 */
export const PDF_TOKENS = {
  margin: 15,
  ruleHeavy: 0.6, // ~2px section divider
  ruleThin: 0.15, // hairline grid divider
  ink: [24, 24, 27],
  inkSoft: [72, 72, 80],
  muted: [128, 128, 138],
  accent: [199, 32, 39], // section headings, bars, meter fill
  accentDark: [124, 20, 25], // overall performance score
  track: [230, 231, 235],
  leaveHighlight: [255, 239, 242], // restrained pale-pink leave section card
  headerBaseline: 13, // running header text baseline on continuation pages
  headerRule: 16,
  contentTop: 23, // first content row on continuation pages
  footerReserve: 20, // kept free at the bottom of every page (rule + footer text)
  footerRule: 14, // measured up from the bottom edge
  footerBaseline: 9.5,
  titleSize: 18, // masthead headline, in points — the logo is sized off this
  logoTitleRatio: 1.75, // logo box height as a multiple of the headline size
  logoGap: 5, // clear space between the logo and the masthead text column
  profileSize: 25, // square employee portrait at the masthead's right edge
  profileGap: 7 // clear space between the masthead text and portrait
};

const PDF_LOGO_SRC = '/logoIcons/pdf-report-logo.png';
let pdfLogoPromise = null;

/**
 * Company logo for the PDF masthead, as a jsPDF-ready data URL plus its natural
 * pixel size (the caller scales by ratio, so the mark never stretches).
 *
 * Resolves to `null` rather than throwing: a missing logo must not take the
 * export down with it. A failure clears the cache so the next export retries.
 */
export const loadPdfLogo = () => {
  if (pdfLogoPromise) return pdfLogoPromise;

  pdfLogoPromise = (async () => {
    const response = await fetch(PDF_LOGO_SRC, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Logo fetch failed (${response.status})`);

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Logo read failed'));
      reader.readAsDataURL(blob);
    });

    const size = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Logo decode failed'));
      image.src = dataUrl;
    });

    return { dataUrl, ...size };
  })().catch((error) => {
    console.warn('PDF logo unavailable — masthead falls back to text only:', error?.message || error);
    pdfLogoPromise = null;
    return null;
  });

  return pdfLogoPromise;
};

/**
 * A single-person export uses the same image shown on that employee's profile.
 * Group exports and employees without a profile photo omit the portrait.
 */
export const getPdfProfileImageSource = (employees = []) => {
  const roster = Array.isArray(employees) ? employees.filter(Boolean) : [];
  if (roster.length !== 1) return null;

  const employee = roster[0];
  return employee.photo
    || employee.avatar_url
    || employee.hr_user?.avatar_url
    || null;
};

const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Profile image decode failed'));
  image.src = src;
});

/**
 * Rasterize any supported profile source (data URL, Supabase URL, or blob URL)
 * to a square PNG. jsPDF can then draw every source through the same path and
 * the portrait keeps object-fit: cover semantics.
 */
const rasterizePdfProfileImage = async (src) => {
  const response = await fetch(src, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Profile image fetch failed (${response.status})`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error('Profile image has no dimensions');

    const size = 384;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Profile image canvas unavailable');

    const scale = Math.max(size / sourceWidth, size / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: size,
      height: size
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

/**
 * Resolves to null rather than failing the export when there is no individual
 * photo or the current profile photo cannot be loaded.
 */
export const loadPdfProfileImage = async (employees = []) => {
  const source = getPdfProfileImageSource(employees);
  if (!source) return null;

  try {
    return await rasterizePdfProfileImage(source);
  } catch (error) {
    console.warn('PDF profile image unavailable:', error?.message || error);
    return null;
  }
};

/** Bar fill widths are percentages of the group maximum, resolved up-front. */
export const withBarPercents = (items = []) => {
  const values = items.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 0);
  return items.map((item, index) => ({
    ...item,
    value: values[index],
    pct: max > 0 ? (values[index] / max) * 100 : 0
  }));
};

/** Filled block count for the 10-block performance meter. */
export const meterFilledBlocks = (score, blocks = 10) => {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(blocks, Math.round(numeric / (100 / blocks))));
};

/**
 * Flow layout for the PDF report. Text is always drawn through the caller's
 * `drawText` / `measureText` / `fitText` so per-script font selection (CJK,
 * Thai, Latin) stays with the font loader — this module never touches setFont.
 *
 * `y` is the top edge of the next block; baselines are derived from font size.
 */
export const createPdfReportLayout = ({
  doc,
  pageWidth,
  pageHeight,
  drawText,
  measureText,
  fitText,
  onNewPage
}) => {
  const T = PDF_TOKENS;
  const left = T.margin;
  const right = pageWidth - T.margin;
  const contentWidth = right - left;
  const bottomLimit = pageHeight - T.footerReserve;
  const pageCapacity = bottomLimit - T.contentTop;
  let y = T.contentTop;

  const ptToMm = (pt) => pt * 0.3528;
  const baselineOf = (top, size) => top + ptToMm(size) * 0.78;
  const lineHeight = (size, factor = 1.5) => ptToMm(size) * factor;

  const hLine = (yy, width, color) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(left, yy, right, yy);
  };

  const newPage = () => {
    doc.addPage();
    y = onNewPage ? onNewPage() : T.contentTop;
    return y;
  };

  const ensure = (height) => {
    if (y + height > bottomLimit) newPage();
    return y;
  };

  return {
    left,
    right,
    contentWidth,
    bottomLimit,
    get y() {
      return y;
    },
    set y(next) {
      y = next;
    },
    newPage,
    ensure,

    /**
     * Page-1 masthead: company logo flush to the left margin, the employee or
     * group portrait flush right, and the title/meta column between them.
     *
     * The logo box is a multiple of the headline point size, not a fixed
     * millimetre height, so the lockup keeps its proportions if the title size
     * is ever retuned. Text is measured against the narrower column the logo
     * leaves, so a long title truncates instead of colliding with the mark.
     */
    titleBlock({ title, metaLines = [], logo = null, profileImage = null }) {
      const top = 18;
      const titleSize = T.titleSize;
      y = top;

      let textLeft = left;
      let textRight = right;
      let logoBottom = top;
      let profileBottom = top;

      if (profileImage?.dataUrl) {
        const profileLeft = right - T.profileSize;
        try {
          doc.addImage(
            profileImage.dataUrl,
            'PNG',
            profileLeft,
            top,
            T.profileSize,
            T.profileSize,
            'reportProfile',
            'FAST'
          );
          textRight = profileLeft - T.profileGap;
          profileBottom = top + T.profileSize;
        } catch (error) {
          console.warn('PDF profile image could not be drawn:', error?.message || error);
        }
      }

      if (logo?.dataUrl) {
        const logoH = ptToMm(titleSize) * T.logoTitleRatio;
        const logoW = logo.height > 0 ? (logo.width / logo.height) * logoH : logoH;
        try {
          doc.addImage(logo.dataUrl, 'PNG', left, top, logoW, logoH, 'reportLogo', 'FAST');
          textLeft = left + logoW + T.logoGap;
          logoBottom = top + logoH;
        } catch (error) {
          console.warn('PDF logo could not be drawn:', error?.message || error);
        }
      }

      const textWidth = Math.max(textRight - textLeft, 10);

      doc.setFontSize(titleSize);
      doc.setTextColor(...T.ink);
      drawText(fitText(title, textWidth, titleSize), textLeft, baselineOf(y, titleSize), { bold: true });
      y += lineHeight(titleSize, 1.25);

      doc.setFontSize(8.5);
      doc.setTextColor(...T.muted);
      metaLines.filter(Boolean).forEach((metaLine) => {
        drawText(fitText(metaLine, textWidth, 8.5), textLeft, baselineOf(y, 8.5));
        y += lineHeight(8.5, 1.45);
      });

      // Short mastheads must still clear both images before the first section rule.
      y = Math.max(y, logoBottom, profileBottom);
    },

    /** 2px section divider. */
    sectionRule({ gapBefore = 5, gapAfter = 6 } = {}) {
      ensure(gapBefore + gapAfter);
      y += gapBefore;
      hLine(y, T.ruleHeavy, T.ink);
      y += gapAfter;
    },

    /** Section headers are bold and accent-coloured; highlighted sections get a filled title band. */
    sectionHeading(text, { fillColor = null } = {}) {
      const textHeight = lineHeight(11, 1.7);
      const padTop = fillColor ? 3 : 0;
      const padBottom = fillColor ? 2 : 0;
      const blockHeight = textHeight + padTop + padBottom;
      const top = y;
      ensure(blockHeight);

      if (fillColor) {
        doc.setFillColor(...fillColor);
        doc.roundedRect(left, top, contentWidth, blockHeight, 3, 3, 'F');
        // Square the lower corners so the title band joins the filled table cleanly.
        doc.rect(left, top + 3, contentWidth, blockHeight - 3, 'F');
        y += padTop;
      }

      doc.setFontSize(11);
      doc.setTextColor(...T.accent);
      const inset = fillColor ? 4 : 0;
      drawText(
        fitText(text, contentWidth - inset * 2, 11),
        left + inset,
        baselineOf(y, 11),
        { bold: true }
      );
      y = top + blockHeight;
    },

    /**
     * Two-column label/value grid. `cells` is a flat list read left-to-right;
     * `null` keeps an empty slot so pairs stay aligned.
     */
    summaryGrid(cells = []) {
      const rows = Math.ceil(cells.length / 2);
      if (rows === 0) return;
      const rowH = 9;
      const gridH = rows * rowH;
      ensure(gridH + 2);

      const top = y;
      const colW = contentWidth / 2;

      doc.setDrawColor(...T.muted);
      doc.setLineWidth(T.ruleThin);
      doc.rect(left, top, contentWidth, gridH);
      doc.line(left + colW, top, left + colW, top + gridH);
      for (let row = 1; row < rows; row += 1) {
        hLine(top + row * rowH, T.ruleThin, T.muted);
      }

      cells.forEach((cell, index) => {
        if (!cell) return;
        const row = Math.floor(index / 2);
        const col = index % 2;
        const cellLeft = left + col * colW + 3.5;
        const cellRight = left + (col + 1) * colW - 3.5;
        const baseline = top + row * rowH + rowH / 2 + 1.2;
        const valueText = String(cell.value ?? '');
        const valueWidth = measureText(valueText, 9.5);

        doc.setFontSize(8);
        doc.setTextColor(...T.muted);
        drawText(
          fitText(cell.label, Math.max(cellRight - cellLeft - valueWidth - 4, 8), 8),
          cellLeft,
          baseline
        );

        doc.setFontSize(9.5);
        doc.setTextColor(...T.ink);
        drawText(valueText, cellRight, baseline, { align: 'right' });
      });

      y = top + gridH;
    },

    /** Label + 10-block meter + value, in one bounded row. */
    meterRow({ label, valueText, filled, blocks = 10 }) {
      const rowH = 12;
      ensure(rowH + 3);
      y += 3;

      const top = y;
      doc.setDrawColor(...T.muted);
      doc.setLineWidth(T.ruleThin);
      doc.rect(left, top, contentWidth, rowH);

      const blockW = 4.4;
      const blockH = 4.4;
      const gap = 1.2;
      const blocksWidth = blocks * blockW + (blocks - 1) * gap;
      const valueWidth = measureText(valueText, 10);
      const blocksX = right - 4 - valueWidth - 5 - blocksWidth;
      const midY = top + rowH / 2;

      doc.setFontSize(9);
      doc.setTextColor(...T.accentDark);
      drawText(fitText(label, Math.max(blocksX - left - 8, 10), 9), left + 4, midY + 1.2, { bold: true });

      for (let i = 0; i < blocks; i += 1) {
        doc.setFillColor(...(i < filled ? T.accent : T.track));
        doc.rect(blocksX + i * (blockW + gap), midY - blockH / 2, blockW, blockH, 'F');
      }

      doc.setFontSize(10);
      doc.setTextColor(...T.accentDark);
      drawText(valueText, right - 4, midY + 1.4, { align: 'right', bold: true });

      y = top + rowH;
    },

    /** Bold sub-header over `label ──bar── value` rows (track + absolute fill). */
    barGroup({ title, items = [] }) {
      if (items.length === 0) return;
      const titleH = 6;
      const rowH = 7;
      const groupH = titleH + items.length * rowH + 3;
      ensure(groupH <= pageCapacity ? groupH : titleH + rowH);

      doc.setFontSize(9.5);
      doc.setTextColor(...T.ink);
      drawText(fitText(title, contentWidth, 9.5), left, baselineOf(y, 9.5), { bold: true });
      y += titleH;

      const labelW = 46;
      const valueW = 20;
      const trackX = left + labelW;
      const trackW = contentWidth - labelW - valueW;
      const trackH = 4.5;

      items.forEach((item) => {
        ensure(rowH);
        const top = y;
        const midY = top + rowH / 2;

        doc.setFontSize(8);
        doc.setTextColor(...T.inkSoft);
        drawText(fitText(item.label, labelW - 3, 8), left, midY + 1.1);

        doc.setFillColor(...T.track);
        doc.rect(trackX, midY - trackH / 2, trackW, trackH, 'F');

        const pct = Math.max(0, Math.min(100, Number(item.pct) || 0));
        const fillW = pct > 0 ? Math.max((pct / 100) * trackW, 0.8) : 0;
        if (fillW > 0) {
          doc.setFillColor(...T.accent);
          doc.rect(trackX, midY - trackH / 2, fillW, trackH, 'F');
        }

        doc.setFontSize(8);
        doc.setTextColor(...T.ink);
        drawText(item.valueText, right, midY + 1.1, { align: 'right' });

        y = top + rowH;
      });

      y += 3;
    }
  };
};
