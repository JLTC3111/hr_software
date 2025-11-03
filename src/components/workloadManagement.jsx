import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Edit2, Trash2, Plus, Calendar, User, TrendingUp, BarChart3, MessageSquare, Loader, Star } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as workloadService from '../services/workloadService';

const WorkloadManagement = ({ employees }) => {
  const { user, checkPermission } = useAuth();
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'organization'
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Modal ref for outside click detection
  const modalRef = React.useRef(null);

  // Check if user can view all employees (admin/manager)
  const canViewAllEmployees = checkPermission('canViewReports');
  
  // Filter employees based on role
  const availableEmployees = canViewAllEmployees 
    ? employees 
    : employees.filter(emp => String(emp.id) === String(user?.employeeId || user?.id));

  // Set selected employee based on role
  const [selectedEmployee, setSelectedEmployee] = useState(
    availableEmployees[0]?.id ? String(availableEmployees[0].id) : null
  );
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'pending',
    selfAssessment: '',
    qualityRating: 0,
    comments: '',
    assignedTo: selectedEmployee // For admin/manager task assignment
  });

  // Check if user is admin or manager
  const canAssignTasks = user?.role === 'admin' || user?.role === 'manager';
  const canViewOrganization = checkPermission('canViewReports'); // Only admin/manager can view organization tab

  // Load tasks from backend
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        let result;
        if (viewMode === 'individual' && selectedEmployee) {
          result = await workloadService.getEmployeeTasks(selectedEmployee);
        } else {
          result = await workloadService.getAllTasks();
        }
        
        if (result.success) {
          setTasks(result.data);
        } else {
          setErrorMessage(result.error || 'Failed to load tasks');
          setTimeout(() => setErrorMessage(''), 5000);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setErrorMessage('Failed to load tasks');
        setTimeout(() => setErrorMessage(''), 5000);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [viewMode, selectedEmployee]);

  // Subscribe to real-time task updates
  useEffect(() => {
    const channel = workloadService.subscribeToTaskChanges(
      viewMode === 'individual' ? selectedEmployee : null,
      (payload) => {
        console.log('Task change:', payload);
        
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(task => 
            task.id === payload.new.id ? payload.new : task
          ));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(task => task.id !== payload.old.id));
        }
      }
    );

    return () => {
      channel.unsubscribe();
    };
  }, [viewMode, selectedEmployee]);

  // Close modal function
  const closeModal = () => {
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
      comments: '',
      assignedTo: selectedEmployee
    });
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showAddTask) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showAddTask, selectedEmployee]);

  // Handle outside click to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        closeModal();
      }
    };

    if (showAddTask) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddTask, selectedEmployee]);

  const handleAddTask = async () => {
    // Validate required fields
    if (!taskForm.title || !taskForm.title.trim()) {
      setErrorMessage('Task title is required');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    // Validate employee assignment for admin/manager
    if (canAssignTasks && !taskForm.assignedTo) {
      setErrorMessage('Please select an employee to assign this task to');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      const result = await workloadService.createTask({
        employeeId: canAssignTasks ? taskForm.assignedTo : selectedEmployee,
        title: taskForm.title,
        description: taskForm.description || null,
        dueDate: taskForm.dueDate || null,
        priority: taskForm.priority,
        status: taskForm.status,
        selfAssessment: taskForm.selfAssessment || null,
        qualityRating: taskForm.qualityRating || 0,
        comments: taskForm.comments || null,
        createdBy: user?.employeeId
      });
      
      if (result.success) {
        setSuccessMessage('Task created successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        setTaskForm({
          title: '',
          description: '',
          dueDate: '',
          priority: 'medium',
          status: 'pending',
          selfAssessment: '',
          qualityRating: 0,
          comments: '',
          assignedTo: selectedEmployee
        });
        setShowAddTask(false);
        // Tasks will update via real-time subscription
      } else {
        setErrorMessage(result.error || 'Failed to create task');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setErrorMessage('Failed to create task');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const result = await workloadService.updateTask(taskId, updates);
      
      if (result.success) {
        setSuccessMessage('Task updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        // Tasks will update via real-time subscription
      } else {
        setErrorMessage(result.error || 'Failed to update task');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setErrorMessage('Failed to update task');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm(t('workload.confirmDelete', 'Delete this task?'))) {
      try {
        const result = await workloadService.deleteTask(taskId);
        
        if (result.success) {
          setSuccessMessage('Task deleted successfully');
          setTimeout(() => setSuccessMessage(''), 3000);
          // Tasks will update via real-time subscription
        } else {
          setErrorMessage(result.error || 'Failed to delete task');
          setTimeout(() => setErrorMessage(''), 5000);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        setErrorMessage('Failed to delete task');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    }
  };

  const getEmployeeTasks = (empId) => {
    return tasks.filter(task => String(task.employee_id) === String(empId));
  };

  const calculateProgress = (empTasks) => {
    if (empTasks.length === 0) return 0;
    const completed = empTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / empTasks.length) * 100);
  };

  const calculateAvgQuality = (empTasks) => {
    const rated = empTasks.filter(t => t.quality_rating > 0);
    if (rated.length === 0) return 0;
    const avg = rated.reduce((sum, t) => sum + t.quality_rating, 0) / rated.length;
    // Return whole number if it's a whole number, otherwise keep one decimal
    return avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(1);
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
            <p className={`text-sm ${text.secondary}`}>{t('workload.totalTasks', '')}</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{employeeTasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.completed', '')}</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {employeeTasks.filter(t => t.status === 'completed').length}
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.progress', '')}</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{progress}%</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgQuality', '')}</p>
            <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{avgQuality}/5</p>
          </div>
        </div>

        {/* Employee Selector - Only for admin/manager */}
        {canViewAllEmployees && availableEmployees.length > 1 && (
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('workload.selectEmployee', 'Select Employee')}
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(String(e.target.value))}
              className={`w-full px-4 py-2 rounded-lg border ${text.primary} ${border.primary} cursor-pointer`}
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              {availableEmployees.map(employee => (
                <option key={employee.id} value={String(employee.id)}>
                  {employee.name} - {t(`employeeDepartment.${employee.department.toLowerCase().replace(/\s+/g, '_')}`, employee.department)} ({t(`employeePosition.${employee.position.toLowerCase().replace(/\s+/g, '')}`, employee.position)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tasks List */}
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${text.primary}`}>
              {canAssignTasks ? t('workload.manageTasks', '') : t('workload.myTasks', '')}
            </h3>
            <button
              onClick={() => {
                setTaskForm({
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'medium',
                  status: 'pending',
                  selfAssessment: '',
                  qualityRating: 0,
                  comments: '',
                  assignedTo: canAssignTasks ? '' : selectedEmployee
                });
                setShowAddTask(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 cursor-pointer" />
              <span>{canAssignTasks ? t('workload.assignTask', '') : t('workload.addTask', '')}</span>
            </button>
          </div>

          <div className="space-y-3">
            {employeeTasks.map(task => (
              <div key={task.id} className={`border ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} ${bg.secondary} ${text.primary} rounded-lg p-4 hover:shadow-md transition-shadow`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <button onClick={() => handleUpdateTask(task.id, { 
                        status: task.status === 'completed' ? 'pending' : 'completed' 
                      })}>
                        {task.status === 'completed' ? 
                          <CheckCircle className={`w-5 h-5 ${text.primary}`} /> : 
                          <Circle className={`w-5 h-5 ${text.primary}`} />
                        }
                      </button>
                      <h4 className={`font-semibold ${text.primary} ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {task.title}
                      </h4>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
                        {t(`workload.${task.priority}`, task.priority)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                        {t(`workload.${task.status}`, task.status)}
                      </span>
                      {canAssignTasks && task.employee && (
                        <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-white' : 'bg-blue-100 text-blue-800'}`}>
                          {task.employee.name}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${text.secondary} mb-2`}>{task.description}</p>
                    {task.due_date && (
                      <p className={`text-xs ${text.secondary} flex items-center space-x-1 mb-2`}>
                        <Calendar className="w-3 h-3" />
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      </p>
                    )}
                    {task.self_assessment && (
                      <div className={`mt-2 p-2 rounded ${bg.primary}`}>
                        <p className={`text-xs ${text.secondary} mb-1`}>
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          {t('workload.selfAssessment', 'Self Assessment')}:
                        </p>
                        <p className={`text-sm ${text.primary}`}>{task.self_assessment}</p>
                        {task.quality_rating > 0 && (
                          <p className={`text-sm ${text.secondary} mt-1 flex items-center space-x-1`}>
                            <span>Quality: {task.quality_rating}/5</span>
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setEditingTask(task);
                        setTaskForm({
                          ...task,
                          assignedTo: task.employee_id
                        });
                        setShowAddTask(true);
                      }}
                      className={`p-2 rounded cursor-pointer ${isDarkMode ? 'hover:bg-green-700' : 'hover:bg-green-100'}`}
                    >
                      <Edit2 className={`w-4 h-4 ${text.primary}`} />
                    </button>
                    <button     
                      onClick={() => handleDeleteTask(task.id)}
                      className={`p-2 rounded text-red-600 cursor-pointer ${isDarkMode ? 'hover:bg-red-900' : 'hover:bg-red-100'}`}
                    >
                      <Trash2 className={`w-4 h-4 ${text.primary}`} />
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
            <p className={`text-sm ${text.secondary}`}>{t('workload.totalTasks', '')}</p>
            <p className={`text-2xl font-bold ${text.primary}`}>{tasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgProgress', '')}</p>
            <p className={`text-2xl font-bold ${text.secondary}`}>
              {Math.round(orgStats.reduce((sum, s) => sum + s.progress, 0) / (orgStats.length || 1))}%
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('workload.avgQuality', '')}</p>
            <p className={`text-2xl font-bold ${text.secondary}`}>
              {(orgStats.reduce((sum, s) => sum + parseFloat(s.avgQuality || 0), 0) / (orgStats.length || 0)).toFixed(0)}/5
            </p>
          </div>
        </div>

        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${text.primary}`}>
              {t('workload.employeeProgress', 'Employee Progress')}
            </h3>
            {canAssignTasks && (
              <button
                onClick={() => {
                  setTaskForm({
                    title: '',
                    description: '',
                    dueDate: '',
                    priority: 'medium',
                    status: 'pending',
                    selfAssessment: '',
                    qualityRating: 0,
                    comments: '',
                    assignedTo: ''
                  });
                  setShowAddTask(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('workload.assignTask', 'Assign Task')}</span>
              </button>
            )}
          </div>
          <div className="space-y-3">
            {orgStats.map(({ employee, tasks, progress, avgQuality }) => (
              <div key={employee.id} className={`border ${border.primary} rounded-lg p-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <User className={`w-5 h-5 ${text.secondary}`} />
                    <div>
                      <p className={`font-semibold ${text.primary}`}>{employee.name}</p>
                      <p className={`text-sm ${text.secondary}`}>{t(`departments.${employee.department}`, employee.department)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-center justify-center">
                    <div>
                      <p className={`${text.secondary}`}>{t('workload.tasks', 'Tasks')}</p>
                      <p className={`font-semiboldcha ${text.primary}`}>{tasks.length}</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>{t('workload.progress', 'Progress')}</p>
                      <p className={`font-semibold ${text.primary}`}>{progress}%</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>{t('workload.quality', 'Quality')}</p>
                      <p className={`font-semibold ${text.primary}`}>{avgQuality}/5</p>
                    </div>
                  </div>
                </div>
                <div className={`mt-3 w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div className="bg-linear-to-r from-blue-500 to-gray-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
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
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex justify-between items-center gap-15">
        <h2 className={`text-2xl font-bold ${text.primary}`}>
          {t('workload.title', '')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('individual')}
            className={`
              px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer
              ${viewMode === 'individual'
                ? 'bg-amber-600 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
            `}
          >
            {t('workload.individual', '')}
          </button>

          {/* Only show organization tab for admin/manager */}
          {canViewOrganization && (
            <button
              onClick={() => setViewMode('organization')}
              className={`
                px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer
                ${viewMode === 'organization'
                  ? 'bg-green-600 text-white'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }
              `}
            >
              {t('workload.organization', '')}
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        viewMode === 'individual' ? <IndividualView /> : <OrganizationView />
      )}

      {/* Add/Edit Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className={`${bg.secondary} rounded-lg shadow-xl max-w-2xl w-full p-6`}>
            <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
              {editingTask ? t('workload.editTask', '') : t('workload.addTask', '')}
            </h3>
            <div className="space-y-4">
              {/* Employee Selector - Only for Admin/Manager */}
              {canAssignTasks && (
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('workload.assignTo', '')} *
                  </label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                  >
                    <option value="">{t('workload.selectEmployee', 'Select Employee')}</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {t(`departments.${emp.department}`, emp.department)} ({t(`employeePosition.${emp.position}`, emp.position)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.taskTitle', 'Task Title')}
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
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
                  className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('workload.dueDate', 'Due Date')}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className={`cursor-pointer w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary} [&::-webkit-calendar-picker-indicator]:opacity-0`}
                  />
                  <Calendar className={`cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${text.secondary} pointer-events-none`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('workload.priority', 'Priority')}
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                  >
                    <option value="low">{t('workload.priorityLow', '')}</option>
                    <option value="medium">{t('workload.priorityMedium', '')}</option>
                    <option value="high">{t('workload.priorityHigh', '')}</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('workload.status', 'Status')}
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                  >
                    <option value="pending">{t('workload.statusPending', '')}</option>
                    <option value="in-progress">{t('workload.statusInProgress', '')}</option>
                    <option value="completed">{t('workload.statusCompleted', '')}</option>
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
                  className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
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
                  className={`w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={closeModal}
                  className={`flex-1 px-4 py-2 border rounded-lg cursor-pointer ${text.secondary} ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (editingTask) {
                    
                      const updates = {
                        title: taskForm.title,
                        description: taskForm.description,
                        dueDate: taskForm.dueDate,
                        priority: taskForm.priority,
                        status: taskForm.status,
                        selfAssessment: taskForm.selfAssessment,
                        qualityRating: taskForm.qualityRating,
                        comments: taskForm.comments
                      };
                      
                      // Only include assignedTo if user is admin/manager and it changed
                      if (canAssignTasks && taskForm.assignedTo !== editingTask.employee_id) {
                        updates.assignedTo = taskForm.assignedTo;
                      }
                      
                      handleUpdateTask(editingTask.id, updates);
                      setEditingTask(null);
                    } else {
                      handleAddTask();
                    }
                    setShowAddTask(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
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
