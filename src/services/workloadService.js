import { supabase } from '../config/supabaseClient';
import { fetchAllRows } from '../utils/fetchAllRows.js';
import { isDemoMode, getDemoTasks, addDemoTask, updateDemoTask, deleteDemoTask, MOCK_TASKS } from '../utils/demoHelper';
import { isCalendarDay, taskCompletionIssue, vietnamCalendarDay } from '../utils/workloadDates.js';

const TASK_STATUSES = new Set(['pending', 'in-progress', 'completed', 'cancelled']);
const valueFor = (data, camelCase, snakeCase) => data[camelCase] !== undefined ? data[camelCase] : data[snakeCase];

const lifecycleError = (task) => {
  if (!TASK_STATUSES.has(task.status)) return 'workload_task_status_required';
  if (task.status !== 'completed' && task.completion_date) return 'workload_task_completion_date_requires_completed';
  const issue = taskCompletionIssue(task);
  if (issue === 'missing') return 'workload_task_completion_date_required';
  if (issue === 'future') return 'workload_task_completion_date_future';
  if (issue === 'invalid') return 'workload_task_completion_date_invalid';
  return null;
};

/**
 * Get all tasks for a specific employee
 * @param {number} employeeId - The employee ID
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const getEmployeeTasks = async (employeeId) => {
  if (isDemoMode()) {
    const tasks = getDemoTasks().filter(t => String(t.employee_id) === String(employeeId));
    return { success: true, data: tasks };
  }

  try {
    const { data, error } = await fetchAllRows(supabase
      .from('workload_tasks')
      .select('*', { count: 'exact' })
      .eq('employee_id', employeeId)
      .order('due_date', { ascending: true }));

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee tasks:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all tasks across the organization
 * @param {object} filters - Optional filters (status, priority, dateRange)
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const getAllTasks = async (filters = {}) => {
  if (isDemoMode()) {
    let tasks = getDemoTasks();
    
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    if (filters.employeeId) {
      tasks = tasks.filter(t => String(t.employee_id) === String(filters.employeeId));
    }
    
    return { success: true, data: tasks };
  }

  try {
    let query = supabase
      .from('workload_tasks')
      .select(`
        *,
        employee:employee_id(id, name, department, position)
      `, { count: 'exact' })
      .order('due_date', { ascending: true });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.employeeId) {
      query = query.eq('employee_id', filters.employeeId);
    }
    if (filters.startDate) {
      query = query.gte('due_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('due_date', filters.endDate);
    }

    const { data, error } = await fetchAllRows(query);

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a single task by ID
 * @param {number} taskId - The task ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getTaskById = async (taskId) => {
  if (isDemoMode()) {
    const task = getDemoTasks().find(t => t.id === taskId);
    return { success: true, data: task || null };
  }

  try {
    const { data, error } = await supabase
      .from('workload_tasks')
      .select(`
        *,
        employee:employee_id(id, name, department, position)
      `)
      .eq('id', taskId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching task:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new task
 * @param {object} taskData - The task data
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const createTask = async (taskData) => {
  const task = {
    employee_id: taskData.employeeId,
    title: taskData.title,
    description: taskData.description,
    due_date: taskData.dueDate || null,
    start_date: valueFor(taskData, 'startDate', 'start_date') || null,
    completion_date: valueFor(taskData, 'completionDate', 'completion_date') || null,
    priority: taskData.priority || 'medium',
    status: taskData.status ?? 'pending',
    self_assessment: taskData.selfAssessment || null,
    quality_rating: taskData.qualityRating || 0,
    comments: taskData.comments || null,
    created_by: taskData.createdBy || null,
  };
  const invalid = lifecycleError(task);
  if (invalid) return { success: false, error: invalid };
  if (isDemoMode()) {
    try {
      const newTask = {
        id: `task-demo-${Date.now()}`,
        ...task,
        employee_id: String(task.employee_id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      // Persist to localStorage
      addDemoTask(newTask);
      return { success: true, data: newTask };
    } catch (error) {
      console.error('Error creating demo task:', error);
      return { success: false, error: error.message };
    }
  }

  try {
    const { data, error } = await supabase
      .from('workload_tasks')
      .insert([task])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating task:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing task
 * @param {number} taskId - The task ID
 * @param {object} updates - The fields to update
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updateTask = async (taskId, updates) => {
  try {
    const updateData = {};
    
    // Map frontend field names to database column names (accept camelCase or snake_case)
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.dueDate !== undefined || updates.due_date !== undefined) {
      updateData.due_date = valueFor(updates, 'dueDate', 'due_date') || null;
    }
    if (updates.startDate !== undefined || updates.start_date !== undefined) {
      const start = valueFor(updates, 'startDate', 'start_date');
      updateData.start_date = start || null;
    }
    if (updates.completionDate !== undefined || updates.completion_date !== undefined) {
      const completion = valueFor(updates, 'completionDate', 'completion_date');
      updateData.completion_date = completion || null;
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status !== 'completed') updateData.completion_date = null;
      const invalid = lifecycleError(updateData);
      if (invalid) return { success: false, error: invalid };
    } else if (updateData.completion_date != null) {
      if (!isCalendarDay(updateData.completion_date)) return { success: false, error: 'workload_task_completion_date_invalid' };
      if (updateData.completion_date > vietnamCalendarDay()) return { success: false, error: 'workload_task_completion_date_future' };
    }
    if (updates.selfAssessment !== undefined || updates.self_assessment !== undefined) {
      updateData.self_assessment = valueFor(updates, 'selfAssessment', 'self_assessment');
    }
    const qualityRating = updates.qualityRating ?? updates.quality_rating;
    if (qualityRating !== undefined) updateData.quality_rating = qualityRating;
    if (updates.comments !== undefined) updateData.comments = updates.comments;
    if (updates.assignedTo !== undefined || updates.employee_id !== undefined) {
      updateData.employee_id = updates.assignedTo ?? updates.employee_id;
    }

    if (isDemoMode()) {
      const previous = getDemoTasks().find((task) => String(task.id) === String(taskId));
      if (!previous) return { success: false, error: 'Task not found' };
      if ('completion_date' in updateData) {
        const invalid = lifecycleError({ ...previous, ...updateData });
        if (invalid) return { success: false, error: invalid };
      }
      return { success: true, data: updateDemoTask(taskId, updateData) };
    }

    const { data, error } = await supabase
      .from('workload_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating task:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a task
 * @param {number} taskId - The task ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteTask = async (taskId) => {
  if (isDemoMode()) {
    deleteDemoTask(taskId);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('workload_tasks')
      .delete()
      .eq('id', taskId)
      .select('id')
      .single();

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting task:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get task statistics for an employee
 * @param {number} employeeId - The employee ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getEmployeeTaskStats = async (employeeId) => {
  if (isDemoMode()) {
    const tasks = getDemoTasks().filter(t => String(t.employee_id) === String(employeeId));
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0
    };
    return { success: true, data: stats };
  }

  try {
    const { data: tasks, error } = await fetchAllRows(supabase
      .from('workload_tasks')
      .select('status, priority, quality_rating, due_date', { count: 'exact' })
      .eq('employee_id', employeeId));

    if (error) throw error;

    // Calculate statistics
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      highPriority: tasks.filter(t => t.priority === 'high').length,
      mediumPriority: tasks.filter(t => t.priority === 'medium').length,
      lowPriority: tasks.filter(t => t.priority === 'low').length,
      overdue: tasks.filter(t => t.status !== 'completed' && new Date(t.due_date) < new Date()).length,
      avgQualityRating: tasks.length > 0 
        ? (tasks.reduce((sum, t) => sum + (t.quality_rating || 0), 0) / tasks.length).toFixed(1)
        : 0,
      completionRate: tasks.length > 0 
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : 0
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching employee task stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get organization-wide task statistics
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const getOrganizationTaskStats = async () => {
  if (isDemoMode()) {
    const stats = {
      totalTasks: MOCK_TASKS.length,
      totalEmployees: 5,
      pending: MOCK_TASKS.filter(t => t.status === 'pending').length,
      inProgress: MOCK_TASKS.filter(t => t.status === 'in-progress').length,
      completed: MOCK_TASKS.filter(t => t.status === 'completed').length,
      completionRate: MOCK_TASKS.length > 0 ? Math.round((MOCK_TASKS.filter(t => t.status === 'completed').length / MOCK_TASKS.length) * 100) : 0
    };
    return { success: true, data: stats };
  }

  try {
    const { data: tasks, error } = await fetchAllRows(supabase
      .from('workload_tasks')
      .select('employee_id, status, priority, quality_rating, due_date', { count: 'exact' }));

    if (error) throw error;

    // Calculate statistics
    const uniqueEmployees = new Set(tasks.map(t => t.employee_id)).size;
    
    const stats = {
      totalTasks: tasks.length,
      totalEmployees: uniqueEmployees,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      highPriority: tasks.filter(t => t.priority === 'high').length,
      mediumPriority: tasks.filter(t => t.priority === 'medium').length,
      lowPriority: tasks.filter(t => t.priority === 'low').length,
      overdue: tasks.filter(t => t.status !== 'completed' && new Date(t.due_date) < new Date()).length,
      avgQualityRating: tasks.length > 0 
        ? (tasks.reduce((sum, t) => sum + (t.quality_rating || 0), 0) / tasks.length).toFixed(1)
        : 0,
      completionRate: tasks.length > 0 
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : 0,
      avgTasksPerEmployee: uniqueEmployees > 0
        ? (tasks.length / uniqueEmployees).toFixed(1)
        : 0
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching organization task stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update task status
 * @param {array} taskIds - Array of task IDs
 * @param {string} status - New status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const bulkUpdateTaskStatus = async (taskIds, status) => {
  try {
    if (!TASK_STATUSES.has(status)) return { success: false, error: 'workload_task_status_required' };
    const ids = [...new Set(taskIds.map(String))];
    if (isDemoMode()) {
      const tasks = getDemoTasks().filter((task) => ids.includes(String(task.id)));
      if (tasks.length !== ids.length) return { success: false, error: 'workload_task_status_selection_unavailable' };
      const today = vietnamCalendarDay();
      const changes = tasks.map((task) => ({
        ...task, status,
        completion_date: status === 'completed' ? (task.status === 'completed' ? task.completion_date : today) : null,
      }));
      const invalid = changes.find((task, index) => tasks[index].status !== task.status && lifecycleError(task));
      if (invalid) return { success: false, error: lifecycleError(invalid) };
      return { success: true, data: changes.map((task) => updateDemoTask(task.id, { status, completion_date: task.completion_date })) };
    }

    const { data, error } = await supabase.rpc('set_workload_task_status', { p_task_ids: ids, p_status: status });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    return { success: false, error: error.message };
  }
};

// Supabase reuses channels by topic. Share the listener across mounts and wait
// for the unsubscribe to finish before a later connection to the same topic.
const taskChannels = new Map();

export const subscribeToTaskChanges = (employeeId, refresh) => {
  const topic = `hr:workload:${employeeId}`;
  let entry = taskChannels.get(topic);
  const connect = () => {
    const notify = () => { entry.listeners.forEach((listener) => listener()); };
    entry.channel = supabase.channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, notify)
      .subscribe((status) => { if (status === 'SUBSCRIBED') notify(); });
  };
  if (!entry) {
    entry = { listeners: new Set(), channel: null, closing: false };
    taskChannels.set(topic, entry);
  }
  entry.listeners.add(refresh);
  if (!entry.channel && !entry.closing) connect();
  return () => {
    entry.listeners.delete(refresh);
    if (entry.listeners.size || entry.closing) return;
    entry.closing = true;
    Promise.resolve(supabase.removeChannel(entry.channel)).catch(() => {}).finally(() => {
      entry.channel = null;
      entry.closing = false;
      if (entry.listeners.size) connect();
      else taskChannels.delete(topic);
    });
  };
};
