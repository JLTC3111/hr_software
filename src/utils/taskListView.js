export const TASK_LIST_PAGE_SIZE = 50;
export const TASK_LIST_STATUSES = ['open', 'pending', 'in-progress', 'completed', 'cancelled', 'closed'];
export const TASK_LIST_SORTS = ['urgency', 'created_at', 'updated_at', 'due_date', 'completion_date'];
export const TASK_LIST_DUE_FILTERS = ['all', 'overdue', 'today', 'upcoming', 'undated'];

export const DEFAULT_TASK_LIST_PREFERENCES = {
  owner: 'all', status: 'open', due: 'all', sort: 'urgency', direction: 'asc', groupByEmployee: false,
};

export const normalizeTaskListPreferences = (value) => ({
  owner: typeof value?.owner === 'string' && value.owner.length > 0 ? value.owner : 'all',
  status: TASK_LIST_STATUSES.includes(value?.status) ? value.status : 'open',
  due: TASK_LIST_DUE_FILTERS.includes(value?.due) ? value.due : 'all',
  sort: TASK_LIST_SORTS.includes(value?.sort) ? value.sort : 'urgency',
  direction: value?.direction === 'desc' ? 'desc' : 'asc',
  groupByEmployee: value?.groupByEmployee === true,
});

const taskPreferenceKey = (userId) => `icue.task-list.preferences.v1.${userId}`;

export const readTaskListPreferences = (userId) => {
  try {
    return normalizeTaskListPreferences(userId ? JSON.parse(localStorage.getItem(taskPreferenceKey(userId))) : null);
  } catch {
    return { ...DEFAULT_TASK_LIST_PREFERENCES };
  }
};

export const writeTaskListPreferences = (userId, value) => {
  try {
    if (userId) localStorage.setItem(taskPreferenceKey(userId), JSON.stringify(normalizeTaskListPreferences(value)));
  } catch {
    // The controls still work for this visit when the browser blocks storage.
  }
};

export const applyLegacyTaskTab = (preferences, tab) => {
  switch (tab) {
    case 'mine': return { ...preferences, owner: 'mine', status: 'open', due: 'all' };
    case 'overdue': return { ...preferences, status: 'open', due: 'overdue' };
    case 'closed': return { ...preferences, status: 'closed' };
    case 'open': return { ...preferences, status: 'open', due: 'all' };
    default: return preferences;
  }
};

const timeValue = (value) => {
  const stamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(stamp) ? stamp : null;
};

const compareDate = (a, b, direction) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return (a < b ? -1 : a > b ? 1 : 0) * (direction === 'desc' ? -1 : 1);
};

const stableId = (a, b) => {
  const x = String(a.id), y = String(b.id);
  return x < y ? -1 : x > y ? 1 : 0;
};

export const taskDueWindow = (row) => {
  if (row.dueDays == null) return 'undated';
  if (row.dueDays < 0) return 'overdue';
  return row.dueDays === 0 ? 'today' : 'upcoming';
};

export const isNewTaskAssignment = (task, now = Date.now()) => {
  const created = timeValue(task.created_at);
  return created != null && created <= now && now - created < 86400000
    && Boolean(task.created_by) && Boolean(task.employee_id) && String(task.created_by) !== String(task.employee_id);
};

const sortableDate = (row, sort) => {
  if (sort === 'completion_date') return row.closedAt;
  if (sort === 'due_date') return row.due;
  return timeValue(row.task[sort]);
};

export const selectTaskListView = (rows, preferences, query = '') => {
  const { owner, status, due, sort, direction } = preferences;
  const needle = query.trim().toLowerCase();
  const matching = rows.filter((row) => {
    if (owner === 'mine' ? !row.mine : owner !== 'all' && row.ownerId !== owner) return false;
    return !needle || [row.title, row.description, row.ownerName, row.creatorName, row.handle]
      .some((value) => String(value || '').toLowerCase().includes(needle));
  });

  const open = matching.filter((row) => row.open && (status === 'open' || row.status === status)
    && (due === 'all' || taskDueWindow(row) === due));
  const history = matching.filter((row) => !row.open && (
    status === 'completed' || status === 'cancelled' ? row.status === status : true
  ));
  const selectedSort = (a, b) => compareDate(sortableDate(a, sort), sortableDate(b, sort), direction);
  const urgency = (a, b) => compareDate(a.dueDays, b.dueDays, 'asc');
  const recency = (a, b) => compareDate(a.closedAt, b.closedAt, 'desc');
  open.sort((a, b) => (sort === 'urgency' ? 0 : selectedSort(a, b)) || urgency(a, b) || stableId(a, b));
  history.sort((a, b) => (sort === 'urgency' ? 0 : selectedSort(a, b)) || recency(a, b) || stableId(a, b));
  return { open, history };
};

export const groupTaskListRows = (rows, groupByEmployee) => {
  if (!groupByEmployee) return [{ key: 'all', rows }];
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.ownerId)) groups.set(row.ownerId, { key: row.ownerId, ownerName: row.ownerName, rows: [] });
    groups.get(row.ownerId).rows.push(row);
  }
  return [...groups.values()];
};
