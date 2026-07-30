export const formatHours = (value, decimals = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return (0).toFixed(decimals);
  const factor = 10 ** decimals;
  return (Math.round(num * factor) / factor).toFixed(decimals);
};

export const filterExportSnapshotByTab = (activeTab, snapshot = {}) => {
  const empty = {
    timeEntries: [],
    tasks: [],
    goals: [],
    leave: [],
    employees: snapshot.employees || [],
  };

  switch (activeTab) {
    case 'time-entries':
      return { ...empty, timeEntries: snapshot.timeEntries || [] };
    case 'tasks':
      return { ...empty, tasks: snapshot.tasks || [] };
    case 'goals':
      return { ...empty, goals: snapshot.goals || [] };
    case 'leave':
      return { ...empty, leave: snapshot.leave || [] };
    case 'all':
    default:
      return {
        timeEntries: snapshot.timeEntries || [],
        tasks: snapshot.tasks || [],
        goals: snapshot.goals || [],
        leave: snapshot.leave || [],
        employees: snapshot.employees || [],
      };
  }
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
  headerBaseline: 13, // running header text baseline on continuation pages
  headerRule: 16,
  contentTop: 23, // first content row on continuation pages
  footerReserve: 20, // kept free at the bottom of every page (rule + footer text)
  footerRule: 14, // measured up from the bottom edge
  footerBaseline: 9.5
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

    /** Page-1 masthead: left-aligned bold title over muted meta lines. */
    titleBlock({ title, metaLines = [] }) {
      y = 18;
      doc.setFontSize(18);
      doc.setTextColor(...T.ink);
      drawText(fitText(title, contentWidth, 18), left, baselineOf(y, 18), { bold: true });
      y += lineHeight(18, 1.25);

      doc.setFontSize(8.5);
      doc.setTextColor(...T.muted);
      metaLines.filter(Boolean).forEach((metaLine) => {
        drawText(fitText(metaLine, contentWidth, 8.5), left, baselineOf(y, 8.5));
        y += lineHeight(8.5, 1.45);
      });
    },

    /** 2px section divider. */
    sectionRule({ gapBefore = 5, gapAfter = 6 } = {}) {
      ensure(gapBefore + gapAfter);
      y += gapBefore;
      hLine(y, T.ruleHeavy, T.ink);
      y += gapAfter;
    },

    /** Section headers are bold and accent-coloured. */
    sectionHeading(text) {
      ensure(lineHeight(11, 1.7));
      doc.setFontSize(11);
      doc.setTextColor(...T.accent);
      drawText(fitText(text, contentWidth, 11), left, baselineOf(y, 11), { bold: true });
      y += lineHeight(11, 1.7);
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
