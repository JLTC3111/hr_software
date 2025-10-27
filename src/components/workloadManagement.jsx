import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Edit2, Trash2, Plus, Calendar, User, TrendingUp, BarChart3, MessageSquare } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const WorkloadManagement = ({ employees }) => {
  const { user } = useAuth();
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  
  const [tasks, setTasks] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'organization'
  const [selectedEmployee, setSelectedEmployee] = useState(user?.employeeId || null);
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'pending',
    selfAssessment: '',
    qualityRating: 0,
    comments: ''
  });

  // Load tasks from localStorage (in production, use database)
  useEffect(() => {
    const savedTasks = localStorage.getItem('hr_tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('hr_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = () => {
    const newTask = {
      id: Date.now(),
      ...taskForm,
      employeeId: selectedEmployee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTasks([...tasks, newTask]);
    setTaskForm({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      status: 'pending',
      selfAssessment: '',
      qualityRating: 0,
      comments: ''
    });
    setShowAddTask(false);
  };

  const handleUpdateTask = (taskId, updates) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
    ));
  };

  const handleDeleteTask = (taskId) => {
    if (window.confirm(t('workload.confirmDelete', 'Delete this task?'))) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  const getEmployeeTasks = (empId) => {
    return tasks.filter(task => task.employeeId === empId);
  };

  const calculateProgress = (empTasks) => {
    if (empTasks.length === 0) return 0;
    const completed = empTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / empTasks.length) * 100);
  };

  const calculateAvgQuality = (empTasks) => {
    const rated = empTasks.filter(t => t.qualityRating > 0);
    if (rated.length === 0) return 0;
    return (rated.reduce((sum, t) => sum + t.qualityRating, 0) / rated.length).toFixed(1);
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Individual View
  const IndividualView = () => {
    const employeeTasks = getEmployeeTasks(selectedEmployee);
    const progress = calculateProgress(employeeTasks);
    const avgQuality = calculateAvgQuality(employeeTasks);

    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.totalTasks', 'Total Tasks')}</p>
            <p className={`text-2xl font-bold ${text.primary}`}>{employeeTasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.completed', 'Completed')}</p>
            <p className={`text-2xl font-bold text-green-600`}>
              {employeeTasks.filter(t => t.status === 'completed').length}
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.progress', 'Progress')}</p>
            <p className={`text-2xl font-bold text-blue-600`}>{progress}%</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgQuality', 'Avg Quality')}</p>
            <p className={`text-2xl font-bold text-purple-600`}>{avgQuality}/5</p>
          </div>
        </div>

        {/* Tasks List */}
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${text.primary}`}>
              {t('workload.myTasks', 'My Tasks')}
            </h3>
            <button
              onClick={() => setShowAddTask(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('workload.addTask', 'Add Task')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {employeeTasks.map(task => (
              <div key={task.id} className={`border ${border.primary} rounded-lg p-4 hover:shadow-md transition-shadow`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <button onClick={() => handleUpdateTask(task.id, { 
                        status: task.status === 'completed' ? 'pending' : 'completed' 
                      })}>
                        {task.status === 'completed' ? 
                          <CheckCircle className="w-5 h-5 text-green-600" /> : 
                          <Circle className="w-5 h-5 text-gray-400" />
                        }
                      </button>
                      <h4 className={`font-semibold ${text.primary} ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {task.title}
                      </h4>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className={`text-sm ${text.secondary} mb-2`}>{task.description}</p>
                    {task.selfAssessment && (
                      <div className={`mt-2 p-2 rounded ${bg.primary}`}>
                        <p className={`text-xs ${text.secondary} mb-1`}>
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          {t('workload.selfAssessment', 'Self Assessment')}:
                        </p>
                        <p className={`text-sm ${text.primary}`}>{task.selfAssessment}</p>
                        {task.qualityRating > 0 && (
                          <p className={`text-sm ${text.secondary} mt-1`}>
                            Quality: {task.qualityRating}/5 ⭐
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setEditingTask(task);
                        setTaskForm(task);
                        setShowAddTask(true);
                      }}
                      className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {employeeTasks.length === 0 && (
              <p className={`text-center py-8 ${text.secondary}`}>
                {t('workload.noTasks', 'No tasks yet. Add your first task!')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Organization View
  const OrganizationView = () => {
    const orgStats = employees.map(emp => ({
      employee: emp,
      tasks: getEmployeeTasks(emp.id),
      progress: calculateProgress(getEmployeeTasks(emp.id)),
      avgQuality: calculateAvgQuality(getEmployeeTasks(emp.id))
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.totalTasks', 'Total Tasks')}</p>
            <p className={`text-2xl font-bold ${text.primary}`}>{tasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgProgress', 'Avg Progress')}</p>
            <p className={`text-2xl font-bold text-blue-600`}>
              {Math.round(orgStats.reduce((sum, s) => sum + s.progress, 0) / (orgStats.length || 1))}%
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgQuality', 'Avg Quality')}</p>
            <p className={`text-2xl font-bold text-purple-600`}>
              {(orgStats.reduce((sum, s) => sum + parseFloat(s.avgQuality || 0), 0) / (orgStats.length || 1)).toFixed(1)}/5
            </p>
          </div>
        </div>

        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>
            {t('workload.employeeProgress', 'Employee Progress')}
          </h3>
          <div className="space-y-3">
            {orgStats.map(({ employee, tasks, progress, avgQuality }) => (
              <div key={employee.id} className={`border ${border.primary} rounded-lg p-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <User className={`w-5 h-5 ${text.secondary}`} />
                    <div>
                      <p className={`font-semibold ${text.primary}`}>{employee.name}</p>
                      <p className={`text-sm ${text.secondary}`}>{employee.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div>
                      <p className={`${text.secondary}`}>Tasks</p>
                      <p className={`font-semibold ${text.primary}`}>{tasks.length}</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>Progress</p>
                      <p className="font-semibold text-blue-600">{progress}%</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>Quality</p>
                      <p className="font-semibold text-purple-600">{avgQuality}/5</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${text.primary}`}>
          {t('workload.title', 'Workload Management')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 rounded-lg ${viewMode === 'individual' ? 'bg-blue-600 text-white' : bg.secondary}`}
          >
            {t('workload.individual', 'Individual')}
          </button>
          <button
            onClick={() => setViewMode('organization')}
            className={`px-4 py-2 rounded-lg ${viewMode === 'organization' ? 'bg-blue-600 text-white' : bg.secondary}`}
          >
            {t('workload.organization', 'Organization')}
          </button>
        </div>
      </div>

      {viewMode === 'individual' ? <IndividualView /> : <OrganizationView />}

      {/* Add/Edit Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${bg.secondary} rounded-lg shadow-xl max-w-2xl w-full p-6`}>
            <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
              {editingTask ? t('workload.editTask', 'Edit Task') : t('workload.addTask', 'Add Task')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.taskTitle', 'Task Title')}
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.description', 'Description')}
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="3"
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('workload.priority', 'Priority')}
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('workload.status', 'Status')}
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.selfAssessment', 'Self Assessment')}
                </label>
                <textarea
                  value={taskForm.selfAssessment}
                  onChange={(e) => setTaskForm({ ...taskForm, selfAssessment: e.target.value })}
                  rows="2"
                  placeholder={t('workload.selfAssessmentPlaceholder', 'How did you perform on this task?')}
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.qualityRating', 'Quality Rating')} (0-5)
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={taskForm.qualityRating}
                  onChange={(e) => setTaskForm({ ...taskForm, qualityRating: parseInt(e.target.value) })}
                  className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddTask(false);
                    setEditingTask(null);
                    setTaskForm({
                      title: '',
                      description: '',
                      dueDate: '',
                      priority: 'medium',
                      status: 'pending',
                      selfAssessment: '',
                      qualityRating: 0,
                      comments: ''
                    });
                  }}
                  className={`flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700`}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (editingTask) {
                      handleUpdateTask(editingTask.id, taskForm);
                      setEditingTask(null);
                    } else {
                      handleAddTask();
                    }
                    setShowAddTask(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTask ? t('common.update', 'Update') : t('common.add', 'Add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadManagement;
