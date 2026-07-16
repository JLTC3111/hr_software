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

export const PDF_CHART_COLORS = [
  [68, 114, 196],
  [112, 173, 71],
  [255, 192, 0],
  [237, 125, 49],
  [91, 155, 213],
  [192, 80, 77],
  [155, 89, 182]
];

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

const ensurePdfSpace = (doc, yPosition, neededHeight, pageHeight) => {
  if (yPosition + neededHeight <= pageHeight - 20) {
    return yPosition;
  }
  doc.addPage();
  return 20;
};

export const drawPdfBarChart = ({
  doc,
  x,
  y,
  width,
  chartHeight,
  title,
  items,
  drawText,
  pageHeight
}) => {
  const barAreaHeight = Math.max(items.length * 8, 24);
  let yPosition = ensurePdfSpace(doc, y, 18 + barAreaHeight, pageHeight);

  doc.setFontSize(11);
  doc.setTextColor(40, 44, 52);
  drawText(title, x, yPosition);
  yPosition += 6;

  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  const labelWidth = 42;
  const barMaxWidth = width - labelWidth - 18;

  items.forEach((item, index) => {
    yPosition = ensurePdfSpace(doc, yPosition, 8, pageHeight);
    const value = Number(item.value) || 0;
    const barWidth = (value / maxValue) * barMaxWidth;
    const color = item.color || PDF_CHART_COLORS[index % PDF_CHART_COLORS.length];

    drawText(String(item.label).substring(0, 24), x, yPosition + 3);
    doc.setFillColor(...color);
    doc.rect(x + labelWidth, yPosition - 2, Math.max(barWidth, value > 0 ? 2 : 0), 5, 'F');
    const displayValue = Number.isFinite(value) && !Number.isInteger(value)
      ? formatHours(value)
      : String(value);
    drawText(displayValue, x + labelWidth + barMaxWidth + 4, yPosition + 3);

    yPosition += 8;
  });

  return yPosition + 4;
};

export const drawPdfChartsSection = ({
  doc,
  pageWidth,
  pageHeight,
  startY,
  charts,
  drawText,
  sectionTitle
}) => {
  let yPosition = ensurePdfSpace(doc, startY, 20, pageHeight);
  doc.setFontSize(13);
  doc.setTextColor(40, 44, 52);
  drawText(sectionTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  charts.forEach((chart) => {
    yPosition = drawPdfBarChart({
      doc,
      x: 15,
      y: yPosition,
      width: pageWidth - 30,
      chartHeight: 40,
      title: chart.title,
      items: chart.items,
      drawText,
      pageHeight
    });
    yPosition += 4;
  });

  return yPosition;
};
