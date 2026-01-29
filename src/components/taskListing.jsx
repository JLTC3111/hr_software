import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, Circle, Edit2, Trash2, Plus, Calendar, User, TrendingUp, BarChart3, MessageSquare, Loader, Star, Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as workloadService from '../services/workloadService';
import * as flubber from 'flubber';
import { isDemoMode, getDemoEmployeeName, getDemoTaskTitle, getDemoTaskDescription } from '../utils/demoHelper';

export const MiniFlubberAutoMorphCompleteTask = ({
  size = 24,
  className = '',
  isDarkMode = false,
  autoMorphInterval = 1000, 
  morphDuration = 500, 
}) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [morphPaths, setMorphPaths] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [maxSegmentLength] = useState(2);
  const iconRefs = useRef({});
  const animationFrameRef = useRef(null);
  const autoMorphTimerRef = useRef(null);

  /** ---------------------------
   * Dynamic Color Selection
   ----------------------------*/
  const getColor = (icon) => {
    if (icon.status === 'approved') {
      return isDarkMode ? 'text-green-400' : 'text-green-700';
    }
    if (icon.status === 'rejected') {
      return isDarkMode ? 'text-red-400' : 'text-red-700';
    }
    if (icon.status === 'standard') {
      return isDarkMode ? 'text-white' : 'text-black';
    }
    return isDarkMode ? 'text-white' : 'text-black';
  };

  /** Icon definitions */
  const icons = [
    { name: 'Circle', Icon: Circle, status: 'stanard' },
    { name: 'CheckCircle', Icon: CheckCircle, status: 'standard' },
  ];

  /** Extract SVG paths for morphing */
  const extractPathsFromIcon = (iconElement) => {
    if (!iconElement) return [];
    const svg = iconElement.querySelector('svg');
    if (!svg) return [];

    const elements = svg.querySelectorAll(
      'path, circle, line, rect, polyline, polygon'
    );

    const paths = Array.from(elements)
      .map((element) => {
        if (element.tagName.toLowerCase() === 'path') {
          return element.getAttribute('d');
        }
        return convertShapeToPath(element);
      })
      .filter(Boolean);

    return paths;
  };

  /** Convert non-path shapes to path data */
  const convertShapeToPath = (element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx'));
      const cy = parseFloat(element.getAttribute('cy'));
      const r = parseFloat(element.getAttribute('r'));
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }

    if (tag === 'line') {
      return `M ${element.getAttribute('x1')},${element.getAttribute(
        'y1'
      )} L ${element.getAttribute('x2')},${element.getAttribute('y2')}`;
    }

    if (tag === 'rect') {
      const x = parseFloat(element.getAttribute('x') || 0);
      const y = parseFloat(element.getAttribute('y') || 0);
      const w = parseFloat(element.getAttribute('width'));
      const h = parseFloat(element.getAttribute('height'));
      return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    }

    if (tag === 'polyline' || tag === 'polygon') {
      const points = element.getAttribute('points').trim().split(/\s+/);
      const cmds = points.map((p, i) => {
        const [x, y] = p.split(',');
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      });
      if (tag === 'polygon') cmds.push('Z');
      return cmds.join(' ');
    }

    return null;
  };

  /** Morph animation logic */
  const morphToIndex = (targetIndex) => {
    if (isAnimating || currentIconIndex === targetIndex) return;

    setIsAnimating(true);

    const currentPaths = extractPathsFromIcon(iconRefs.current[currentIconIndex]);
    const nextPaths = extractPathsFromIcon(iconRefs.current[targetIndex]);

    if (!currentPaths.length || !nextPaths.length) {
      setCurrentIconIndex(targetIndex);
      setIsAnimating(false);
      return;
    }

    let interpolators;

    try {
      const maxPaths = Math.max(currentPaths.length, nextPaths.length);
      const paddedCurrent = [...currentPaths];
      const paddedNext = [...nextPaths];

      while (paddedCurrent.length < maxPaths) {
        paddedCurrent.push(paddedCurrent[paddedCurrent.length - 1]);
      }
      while (paddedNext.length < maxPaths) {
        paddedNext.push(paddedNext[paddedNext.length - 1]);
      }

      interpolators = paddedCurrent.map((c, i) =>
        flubber.interpolate(c, paddedNext[i], { maxSegmentLength })
      );
    } catch {
      interpolators = [
        flubber.interpolate(currentPaths.join(' '), nextPaths.join(' '), {
          maxSegmentLength,
        }),
      ];
    }

    const start = Date.now();

    const animate = () => {
      const elapsed = Date.now() - start;
      let t = Math.min(elapsed / morphDuration, 1);

      // easeInOutQuad
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const morphed = interpolators.map((fn) => fn(t));
      setMorphPaths(morphed);

      if (elapsed < morphDuration) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentIconIndex(targetIndex);
        setIsAnimating(false);
        setMorphPaths([]);
      }
    };

    animate();
  };

  /** Auto-morph to next icon */
  const morphToNext = () => {
    const nextIndex = (currentIconIndex + 1) % icons.length;
    morphToIndex(nextIndex);
  };

  /** Set up auto-morphing interval */
  useEffect(() => {
    autoMorphTimerRef.current = setInterval(() => {
      morphToNext();
    }, autoMorphInterval);

    return () => {
      if (autoMorphTimerRef.current) {
        clearInterval(autoMorphTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIconIndex, autoMorphInterval]);

  const CurrentIcon = icons[currentIconIndex].Icon;
  const currentColor = getColor(icons[currentIconIndex]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        {isAnimating && morphPaths.length > 0 ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={currentColor}
            stroke="currentColor"
            color="currentColor"
          >
            {morphPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <CurrentIcon
            size={size}
            className={currentColor}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Hidden icons for path extraction */}
      <div
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          left: '-9999px',
        }}
      >
        {icons.map((icon, i) => (
          <div key={i} ref={(el) => (iconRefs.current[i] = el)}>
            <icon.Icon size={24} />
          </div>
        ))}
      </div>
    </div>
  );
};

const TaskListing = ({ employees }) => {
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
  const dueDateInputRef = useRef(null);

  // Check if user can view all employees (admin/manager)
  const canViewAllEmployees = checkPermission('canViewReports');
  
  // Filter employees based on role
  const availableEmployees = canViewAllEmployees 
    ? employees 
    : employees.filter(emp => String(emp.id) === String(user?.employeeId || user?.id));

  // Set selected employee - default to logged-in user's employeeId
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // Modal mode: 'add' | 'assign' | 'edit' | null
  const [modalMode, setModalMode] = useState(null);
  
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
    assignedTo: null // For admin/manager task assignment
  });

  // Check if user is admin or manager
  const canAssignTasks = user?.role === 'admin' || user?.role === 'manager';
  const canViewOrganization = checkPermission('canViewReports'); // Only admin/manager can view organization tab

  // Set logged-in user as default selected employee on mount
  useEffect(() => {
    if (user && employees.length > 0 && !selectedEmployee) {
      const userEmployeeId = String(user.employeeId || user.id);
      const userEmployee = employees.find(emp => String(emp.id) === userEmployeeId);
      
      if (userEmployee) {
        setSelectedEmployee(String(userEmployee.id));
        // Also set as default assignedTo in task form
        setTaskForm(prev => ({ ...prev, assignedTo: String(userEmployee.id) }));
      } else if (availableEmployees.length > 0) {
        // Fallback to first available employee if user's employee record not found
        setSelectedEmployee(String(availableEmployees[0].id));
        setTaskForm(prev => ({ ...prev, assignedTo: String(availableEmployees[0].id) }));
      }
    }
  }, [user, employees, availableEmployees, selectedEmployee]);

  // Load tasks from backend
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
        setTasks(result.data || []);
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

  useEffect(() => {
    if (selectedEmployee) {
      fetchTasks();
    }
  }, [viewMode, selectedEmployee]);

  // Subscribe to real-time task updates
  useEffect(() => {
    const channel = workloadService.subscribeToTaskChanges(
      viewMode === 'individual' ? selectedEmployee : null,
      (payload) => {
        console.log('Task change:', payload);
        
        // Refetch tasks to get complete data with employee info
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          fetchTasks();
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
    setModalMode(null);
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
      setErrorMessage(t('taskListing.titleRequired', 'Task title is required'));
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    // Determine employee ID - use assignedTo if set, otherwise fall back to selectedEmployee
    const employeeId = taskForm.assignedTo || selectedEmployee;
    
    // Validate employee assignment
    if (!employeeId) {
      setErrorMessage(t('taskListing.selectEmployee', 'Please select an employee to assign this task to'));
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    
    try {
      // Use service for both demo and non-demo mode (service handles persistence)
      const result = await workloadService.createTask({
        employeeId: employeeId,
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
        setSuccessMessage(t('taskListing.taskCreated', 'Task created successfully'));
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
        // Refetch tasks to get complete data
        fetchTasks();
      } else {
        setErrorMessage(result.error || t('taskListing.taskCreateError', 'Failed to create task'));
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setErrorMessage(t('taskListing.taskCreateError', 'Failed to create task'));
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      // Use service for both demo and non-demo mode
      const result = await workloadService.updateTask(taskId, updates);
      
      if (result.success) {
        setSuccessMessage(t('taskListing.taskUpdated', 'Task updated successfully'));
        setTimeout(() => setSuccessMessage(''), 3000);
        // Refetch tasks to get complete data with employee info
        fetchTasks();
      } else {
        setErrorMessage(result.error || t('taskListing.taskUpdateError', 'Failed to update task'));
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setErrorMessage(t('taskListing.taskUpdateError', 'Failed to update task'));
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm(t('taskListing.confirmDelete', 'Delete this task?'))) {
      try {
        // Use service for both demo and non-demo mode
        const result = await workloadService.deleteTask(taskId);
        
        if (result.success) {
          setSuccessMessage(t('taskListing.taskDeleted', 'Task deleted successfully'));
          setTimeout(() => setSuccessMessage(''), 3000);
          // Refetch tasks to get complete data
          fetchTasks();
        } else {
          setErrorMessage(result.error || t('taskListing.taskDeleteError', 'Failed to delete task'));
          setTimeout(() => setErrorMessage(''), 5000);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        setErrorMessage(t('taskListing.taskDeleteError', 'Failed to delete task'));
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

  // Map certain statuses to a numeric percent for clarity
  const statusToPercent = (status) => {
    if (!status) return undefined;
    const s = String(status).toLowerCase();
    if (s === 'completed') return 100;
    if (s === 'notstarted' || s === 'not_started' || s === 'not started' || s === 'notstarted') return 0;
    return undefined;
  };

  // Individual View
  const IndividualView = () => {
    const employeeTasks = getEmployeeTasks(selectedEmployee);
    const progress = calculateProgress(employeeTasks);
    const avgQuality = calculateAvgQuality(employeeTasks);

    return (
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.totalTasks', '')}</p>
            <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{employeeTasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.completed', '')}</p>
            <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {employeeTasks.filter(t => t.status === 'completed').length}
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.progress', '')}</p>
            <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{progress}%</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.avgQuality', '')}</p>
            <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{avgQuality}/5</p>
          </div>
        </div>

        {/* Employee Selector - Only for admin/manager */}
        {canViewAllEmployees && availableEmployees.length > 1 && (
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <label className={`block text-sm font-medium ${text.primary} mb-2`}>
              {t('taskListing.selectEmployee', 'Select Employee')}
            </label>
            <div className="relative">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(String(e.target.value))}
                className={`w-full px-4 py-2 pr-10 rounded-lg border ${text.primary} ${border.primary} cursor-pointer appearance-none`}
                style={{
                  backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
                }}
              >
                {availableEmployees.map(employee => (
                  <option key={employee.id} value={String(employee.id)}>
                    {getDemoEmployeeName(employee, t)} - {t(`employeeDepartment.${employee.department.toLowerCase().replace(/\s+/g, '_')}`, employee.department)} ({t(`employeePosition.${getEmployeePositionI18nKey(employee.position)}`, employee.position)})
                  </option>
                ))}
              </select>
              <Users className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary} pointer-events-none`} />
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${text.primary}`}>
              {canAssignTasks ? t('taskListing.manageTasks', '') : t('taskListing.myTasks', '')}
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
                setModalMode('add');
                setShowAddTask(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 cursor-pointer" />
              <span>{t('taskListing.addTask', '')}</span>
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
                          <MiniFlubberAutoMorphCompleteTask isDarkMode={isDarkMode} className={`w-5 h-5 ${text.primary}`} /> : 
                          <Circle className={`w-5 h-5 ${text.primary}`} />
                        }
                      </button>
                      <h4 className={`font-semibold ${text.primary} ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {isDemoMode() ? getDemoTaskTitle(task, t) : task.title}
                      </h4>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)} ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {t(`taskListing.${task.priority}`, task.priority)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)} ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {t(`taskListing.${task.status}`, task.status)}
                        {typeof statusToPercent === 'function' && statusToPercent(task.status) !== undefined ? (
                          <span className="ml-1">({statusToPercent(task.status)})</span>
                        ) : null}
                      </span>
                      {canAssignTasks && task.employee && (
                        <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-blue-900/30 text-white' : 'bg-blue-100 text-blue-800'}`}>
                          {getDemoEmployeeName(task.employee, t)}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${text.secondary} mb-2`}>{isDemoMode() ? getDemoTaskDescription(task, t) : task.description}</p>
                    {task.due_date && (
                      <p className={`text-xs ${text.secondary} flex items-center space-x-1 mb-2`}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTask(task);
                            setTaskForm({
                              ...task,
                              title: isDemoMode() ? getDemoTaskTitle(task, t) : task.title,
                              description: isDemoMode() ? getDemoTaskDescription(task, t) : task.description,
                              dueDate: task.due_date,
                              assignedTo: task.employee_id
                            });
                            setModalMode('edit');
                            setShowAddTask(true);
                            setTimeout(() => {
                              const el = dueDateInputRef.current;
                              if (!el) return;
                              if (typeof el.showPicker === 'function') {
                                el.showPicker();
                              } else {
                                el.focus();
                                if (typeof el.click === 'function') el.click();
                              }
                            }, 250);
                          }}
                          className="inline-flex items-center justify-center w-4 h-4"
                          aria-label={t('taskListing.openDueDatePicker', 'Open due date picker')}
                        >
                          <Calendar className="w-3 h-3" />
                        </button>
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      </p>
                    )}
                    
                    {/* Assigned info: Assigned To, Assigned By, Assign Date */}
                    <div className={`mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs ${text.secondary}`}>
                      <div>
                        <p className="font-medium">{t('taskReview.assignedTo') || 'Assigned To'}</p>
                        <p className={text.primary}>{employees.find(e => String(e.id) === String(task.employee_id))?.name || task.employee?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="font-medium">{t('taskReview.assignedBy') || 'Assigned By'}</p>
                        <p className={text.primary}>{employees.find(e => String(e.id) === String(task.created_by))?.name || '-'}</p>
                      </div>
                      <div>
                        <p className="font-medium">{t('taskListing.assignDate', 'Assign Date')}</p>
                        <p className={text.primary}>{task.created_at ? new Date(task.created_at).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setEditingTask(task);
                        setTaskForm({
                          ...task,
                          title: isDemoMode() ? getDemoTaskTitle(task, t) : task.title,
                          description: isDemoMode() ? getDemoTaskDescription(task, t) : task.description,
                          assignedTo: task.employee_id
                        });
                        setModalMode('edit');
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
                {t('taskListing.noTasks', 'No tasks yet. Add your first task!')}
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

    // Sort employees by task status priority:
    // 1) completed count (desc)
    // 2) in-progress count (desc)
    // 3) pending count (desc)
    // 4) total tasks (desc)
    // 5) employee name (asc)
    const orgStatsSorted = [...orgStats].sort((a, b) => {
      const aTasks = a.tasks || [];
      const bTasks = b.tasks || [];

      const countBy = (tasks, status) => tasks.filter(t => String(t.status).toLowerCase() === status).length;

      const aCompleted = countBy(aTasks, 'completed');
      const bCompleted = countBy(bTasks, 'completed');
      if (bCompleted !== aCompleted) return bCompleted - aCompleted;

      const aInProgress = countBy(aTasks, 'in-progress');
      const bInProgress = countBy(bTasks, 'in-progress');
      if (bInProgress !== aInProgress) return bInProgress - aInProgress;

      const aPending = countBy(aTasks, 'pending');
      const bPending = countBy(bTasks, 'pending');
      if (bPending !== aPending) return bPending - aPending;

      // fallback to total tasks
      if (bTasks.length !== aTasks.length) return bTasks.length - aTasks.length;

      // final fallback: alphabetical by employee name
      const aName = (a.employee?.name || '').toLowerCase();
      const bName = (b.employee?.name || '').toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.totalTasks', '')}</p>
            <p className={`text-xl font-bold ${text.primary}`}>{tasks.length}</p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm text-center ${text.secondary}`}>{t('taskListing.avgProgress', '')}</p>
            <p className={`text-xl text-center font-bold ${text.secondary}`}>
              {Math.round(orgStats.reduce((sum, s) => sum + s.progress, 0) / (orgStats.length || 1))}%
            </p>
          </div>
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <p className={`text-sm ${text.secondary}`}>{t('taskListing.avgQuality', '')}</p>
            <p className={`text-xl font-bold ${text.secondary}`}>
              {(orgStats.reduce((sum, s) => sum + parseFloat(s.avgQuality || 0), 0) / (orgStats.length || 0)).toFixed(0)}/5
            </p>
          </div>
        </div>

        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${text.primary}`}>
              {t('taskListing.employeeProgress', 'Employee Progress')}
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
                  setModalMode('assign');
                  setShowAddTask(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('taskListing.assignTask', 'Assign Task')}</span>
              </button>
            )}
          </div>
          <div className="space-y-3">
            {orgStatsSorted.map(({ employee, tasks, progress, avgQuality }) => (
              <div key={employee.id} className={`border ${border.primary} rounded-lg p-4`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <User className={`w-5 h-5 ${text.secondary}`} />
                    <div>
                      <p className={`font-semibold ${text.primary}`}>{getDemoEmployeeName(employee, t)}</p>
                      <p className={`text-sm ${text.secondary}`}>{t(`employeeDepartment.${employee.department}`, employee.department)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-center justify-center">
                    <div>
                      <p className={`${text.secondary}`}>{t('taskListing.tasks', 'Tasks')}</p>
                      <p className={`font-semiboldcha ${text.primary}`}>{tasks.length}</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>{t('taskListing.progress', 'Progress')}</p>
                      <p className={`font-semibold ${text.primary}`}>{progress}%</p>
                    </div>
                    <div>
                      <p className={`${text.secondary}`}>{t('taskListing.quality', 'Quality')}</p>
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
          {t('taskListing.title', '')}
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
            {t('taskListing.individual', '')}
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
              {t('taskListing.organization', '')}
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
              {modalMode === 'assign'
                ? t('taskListing.assignTask', 'Assign Task')
                : modalMode === 'edit'
                ? t('taskListing.editTask', '')
                : t('taskListing.addTask', '')
              }
            </h3>
            <div className="space-y-4">
              {/* Employee Selector - only shown when assigning or editing (and assigners can assign) */}
              {(modalMode === 'assign' || (modalMode === 'edit' && canAssignTasks)) && (
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('taskListing.assignTo', '')} *
                  </label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg ${text.secondary} ${border.primary}`}
                  >
                    <option value="">{t('taskListing.selectEmployee', 'Select Employee')}</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {getDemoEmployeeName(emp, t)} - {t(`employeeDepartment.${emp.department}`, emp.department)} ({t(`employeePosition.${emp.position}`, emp.position)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('taskListing.taskTitle', 'Task Title')}
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className={`w-full px-4 py-2 rounded-lg border border-gray-300 ${text.secondary} ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('taskListing.description', 'Description')}
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="3"
                  className={`w-full border-gray-300 px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('taskListing.dueDate', 'Due Date')}
                </label>
                  <div className="relative">
                  <input
                    ref={dueDateInputRef}
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className={`cursor-pointer border-gray-300 w-full px-4 py-2 rounded-lg border ${text.secondary} ${border.primary} [&::-webkit-calendar-picker-indicator]:opacity-0`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = dueDateInputRef.current;
                      if (!el) return;
                      if (typeof el.showPicker === 'function') {
                        el.showPicker();
                      } else {
                        el.focus();
                        if (typeof el.click === 'function') el.click();
                      }
                    }}
                    className={`cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center ${text.secondary}`}
                    aria-label={t('taskListing.openDatePicker', 'Open date picker')}
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('taskListing.priority', 'Priority')}
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className={`w-full px-4 border-gray-300 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                  >
                    <option value="low">{t('taskListing.priorityLow', '')}</option>
                    <option value="medium">{t('taskListing.priorityMedium', '')}</option>
                    <option value="high">{t('taskListing.priorityHigh', '')}</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    {t('taskListing.status', 'Status')}
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className={`w-full px-4 border-gray-300 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                  >
                    <option value="pending">{t('taskListing.statusPending', '')}</option>
                    <option value="in-progress">{t('taskListing.statusInProgress', '')}</option>
                    <option value="completed">{t('taskListing.statusCompleted', '')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('taskListing.selfAssessment', 'Self Assessment')}
                </label>
                <textarea
                  value={taskForm.selfAssessment}
                  onChange={(e) => setTaskForm({ ...taskForm, selfAssessment: e.target.value })}
                  rows="2"
                  placeholder={t('taskListing.selfAssessmentPlaceholder', 'How did you perform on this task?')}
                  className={`w-full border-gray-300 px-4 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                  {t('taskListing.qualityRating', 'Quality Rating')} (0-5)
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={taskForm.qualityRating}
                  onChange={(e) => setTaskForm({ ...taskForm, qualityRating: parseInt(e.target.value) })}
                  className={`w-full px-4 border-gray-300 py-2 rounded-lg border ${text.secondary} ${border.primary}`}
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

export default TaskListing;
