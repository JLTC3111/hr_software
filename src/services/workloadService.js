import { supabase } from '../config/supabaseClient';
import { isDemoMode, getDemoTasks, addDemoTask, updateDemoTask, deleteDemoTask, MOCK_TASKS } from '../utils/demoHelper';

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
    const { data, error } = await supabase
      .from('workload_tasks')
      .select('*')
      .eq('employee_id', employeeId)
      .order('due_date', { ascending: true });

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
      `)
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

    const { data, error } = await query;

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
  if (isDemoMode()) {
    try {
      const newTask = {
        id: `task-demo-${Date.now()}`,
        employee_id: String(taskData.employeeId), // Ensure string for consistency
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.dueDate,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        self_assessment: taskData.selfAssessment || null,
        quality_rating: taskData.qualityRating || 0,
        comments: taskData.comments || null,
        created_by: taskData.createdBy || null,
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
      .insert([{
        employee_id: taskData.employeeId,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.dueDate,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        self_assessment: taskData.selfAssessment || null,
        quality_rating: taskData.qualityRating || 0,
        comments: taskData.comments || null,
        created_by: taskData.createdBy || null
      }])
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
  if (isDemoMode()) {
    const updatedTask = updateDemoTask(taskId, updates);
    if (updatedTask) {
      return { success: true, data: updatedTask };
    }
    return { success: false, error: 'Task not found' };
  }

  try {
    const updateData = {};
    
    // Map frontend field names to database column names
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.selfAssessment !== undefined) updateData.self_assessment = updates.selfAssessment;
    if (updates.qualityRating !== undefined) updateData.quality_rating = updates.qualityRating;
    if (updates.comments !== undefined) updateData.comments = updates.comments;
    if (updates.assignedTo !== undefined) updateData.employee_id = updates.assignedTo;

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
      .eq('id', taskId);

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
    const { data: tasks, error } = await supabase
      .from('workload_tasks')
      .select('status, priority, quality_rating, due_date')
      .eq('employee_id', employeeId);

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
    const { data: tasks, error } = await supabase
      .from('workload_tasks')
      .select('employee_id, status, priority, quality_rating, due_date');

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
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('workload_tasks')
      .update({ status })
      .in('id', taskIds);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to task changes for real-time updates
 * @param {number} employeeId - Optional employee ID to filter by
 * @param {function} callback - Callback function to handle changes
 * @returns {object} Subscription object
 */
export const subscribeToTaskChanges = (employeeId = null, callback) => {
  let channel = supabase
    .channel('workload_tasks_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workload_tasks',
        filter: employeeId ? `employee_id=eq.${employeeId}` : undefined
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return channel;
};
