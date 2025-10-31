import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  Pickaxe, 
  Award, 
  Star, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TimerOff,
  BarChart3,
  MessageSquare,
  Edit2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as workloadService from '../services/workloadService';

const TaskPerformanceReview = ({ employees }) => {
  const { user } = useAuth();
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  const { t } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState(user?.employeeId || null);
  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'team'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'in-progress', 'pending'
  const [evaluatingTask, setEvaluatingTask] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState({
    qualityRating: 0,
    comments: '',
    selfAssessment: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Modal ref for outside click detection
  const modalRef = React.useRef(null);

  // Check if user is admin or manager
  const canEvaluateOthers = user?.role === 'admin' || user?.role === 'manager';

  // Load tasks for selected month
  useEffect(() => {
    const fetchMonthlyTasks = async () => {
      setLoading(true);
      try {
        let result;
        if (viewMode === 'individual' && selectedEmployee) {
          result = await workloadService.getEmployeeTasks(selectedEmployee);
        } else {
          result = await workloadService.getAllTasks();
        }
        
        if (result.success) {
          // Filter tasks by selected month
          const filtered = result.data.filter(task => {
            const taskDate = new Date(task.created_at);
            return (
              taskDate.getMonth() === selectedMonth.getMonth() &&
              taskDate.getFullYear() === selectedMonth.getFullYear()
            );
          });
          setTasks(filtered);
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

    fetchMonthlyTasks();
  }, [selectedMonth, viewMode, selectedEmployee]);

  // Calculate monthly statistics
  const monthlyStats = useMemo(() => {
    const filteredTasks = filterStatus === 'all' 
      ? tasks 
      : tasks.filter(t => t.status === filterStatus);

    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress').length;
    const pendingTasks = filteredTasks.filter(t => t.status === 'pending').length;
    const overdueTasks = filteredTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date() && t.status !== 'completed';
    }).length;

    const ratedTasks = filteredTasks.filter(t => t.quality_rating > 0);
    const avgQuality = ratedTasks.length > 0
      ? Math.round(ratedTasks.reduce((sum, t) => sum + t.quality_rating, 0) / ratedTasks.length)
      : 0;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const onTimeCompletions = filteredTasks.filter(t => {
      if (t.status !== 'completed' || !t.due_date || !t.updated_at) return false;
      return new Date(t.updated_at) <= new Date(t.due_date);
    }).length;
    const onTimeRate = completedTasks > 0 
      ? Math.round((onTimeCompletions / completedTasks) * 100) 
      : 0;

    // Priority distribution
    const highPriority = filteredTasks.filter(t => t.priority === 'high').length;
    const mediumPriority = filteredTasks.filter(t => t.priority === 'medium').length;
    const lowPriority = filteredTasks.filter(t => t.priority === 'low').length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks,
      avgQuality,
      completionRate,
      onTimeRate,
      onTimeCompletions,
      highPriority,
      mediumPriority,
      lowPriority,
      ratedTasks: ratedTasks.length
    };
  }, [tasks, filterStatus]);

  // Get tasks for display (filtered)
  const displayTasks = useMemo(() => {
    return filterStatus === 'all' 
      ? tasks 
      : tasks.filter(t => t.status === filterStatus);
  }, [tasks, filterStatus]);

  // Handle month navigation
  const navigateMonth = (direction) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedMonth(newDate);
  };

  // Handle evaluation submission
  const handleSubmitEvaluation = async () => {
    if (!evaluatingTask) return;

    try {
      const updates = {};
      
      // Admin/Manager can update quality rating and comments
      if (canEvaluateOthers) {
        if (evaluationForm.qualityRating > 0) {
          updates.qualityRating = evaluationForm.qualityRating;
        }
        if (evaluationForm.comments) {
          updates.comments = evaluationForm.comments;
        }
      }
      
      // Employee can update self-assessment
      if (evaluationForm.selfAssessment !== evaluatingTask.self_assessment) {
        updates.selfAssessment = evaluationForm.selfAssessment;
      }

      const result = await workloadService.updateTask(evaluatingTask.id, updates);

      if (result.success) {
        setSuccessMessage('Evaluation submitted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Update local task state
        setTasks(prev => prev.map(t => 
          t.id === evaluatingTask.id 
            ? { ...t, ...updates, quality_rating: updates.qualityRating || t.quality_rating }
            : t
        ));
        
        setEvaluatingTask(null);
        setEvaluationForm({ qualityRating: 0, comments: '', selfAssessment: '' });
      } else {
        setErrorMessage(result.error || 'Failed to submit evaluation');
        setTimeout(() => setErrorMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      setErrorMessage('Failed to submit evaluation');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  // Open evaluation modal
  const openEvaluationModal = (task) => {
    setEvaluatingTask(task);
    setEvaluationForm({
      qualityRating: task.quality_rating || 0,
      comments: task.comments || '',
      selfAssessment: task.self_assessment || ''
    });
  };

  // Close evaluation modal
  const closeEvaluationModal = () => {
    setEvaluatingTask(null);
    setEvaluationForm({ qualityRating: 0, comments: '', selfAssessment: '' });
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && evaluatingTask) {
        closeEvaluationModal();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [evaluatingTask]);

  // Handle outside click to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        closeEvaluationModal();
      }
    };

    if (evaluatingTask) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [evaluatingTask]);

  // Get quality color
  const getQualityColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800';
      case 'in-progress': return isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800';
      case 'pending': return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
      default: return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  // Get status text (translated)
  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return t('taskPerformance.completed', 'Completed');
      case 'in-progress': return t('taskPerformance.inProgress', 'In Progress');
      case 'pending': return t('taskPerformance.pending', 'Pending');
      default: return status;
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800';
      case 'medium': return isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800';
      case 'low': return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800';
      default: return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  // Get priority text (translated)
  const getPriorityText = (priority) => {
    switch(priority) {
      case 'high': return t('workload.priorityHigh', 'High Priority');
      case 'medium': return t('workload.priorityMedium', 'Medium Priority');
      case 'low': return t('workload.priorityLow', 'Low Priority');
      default: return priority;
    }
  };

  // Format month display
  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Team View Component
  const TeamView = () => {
    const teamStats = employees.map(emp => {
      const empTasks = tasks.filter(t => t.employee_id === emp.id);
      const completed = empTasks.filter(t => t.status === 'completed').length;
      const total = empTasks.length;
      const rated = empTasks.filter(t => t.quality_rating > 0);
      const avgQuality = rated.length > 0
        ? Math.round(rated.reduce((sum, t) => sum + t.quality_rating, 0) / rated.length)
        : 0;

      return {
        employee: emp,
        totalTasks: total,
        completedTasks: completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        avgQuality: parseFloat(avgQuality)
      };
    }).filter(stat => stat.totalTasks > 0); // Only show employees with tasks

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamStats.map(stat => (
            <div key={stat.employee.id} className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
              <div className="flex items-center space-x-3 mb-3">
                {stat.employee.photo ? (
                  <img 
                    src={stat.employee.photo} 
                    alt={stat.employee.name}
                    className={`w-10 h-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center font-bold text-white bg-blue-500`}>
                    {stat.employee.name?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <p className={`font-semibold ${text.primary}`}>{stat.employee.name}</p>
                  <p className={`text-xs ${text.secondary}`}>{t(`employeePosition.${stat.employee.position}`, stat.employee.position)}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.totalTasks', 'Tasks')}</span>
                  <span className={`font-semibold ${text.primary}`}>{stat.totalTasks}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.completed', 'Completed')}</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stat.completedTasks}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.completionRate', 'Completion Rate')}</span>
                  <span className={`font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{stat.completionRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.avgQuality', 'Avg Quality')}</span>
                  <span className={`font-semibold ${getQualityColor(stat.avgQuality)}`}>
                    {stat.avgQuality}/5 ⭐
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 shadow-sm ${isDarkMode ? 'bg-linear-to-r from-blue-600 to-blue-400' : 'bg-linear-to-r from-blue-500 to-blue-600'}`}
                    style={{ width: `${stat.completionRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {teamStats.length === 0 && (
          <div className={`${bg.secondary} rounded-lg p-8 text-center border ${border.primary}`}>
            <p className={text.secondary}>{t('taskPerformance.noTeamTasks', 'No team tasks found for this month')}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${text.primary}`}>
            {t('taskPerformance.title', '')}
          </h2>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('taskPerformance.subtitle', 'Monthly task progress and quality evaluation')}
          </p>
        </div>

        {/* View Mode Toggle */}
        {canEvaluateOthers && (
          <div className="flex space-x-2">
            <button
                onClick={() => setViewMode('individual')}
                className={`px-4 py-2 rounded-lg cursor-pointer ${text.primary} ${
                viewMode === 'individual' ? 'bg-blue-600 text-white' : bg.secondary
                }`}
            >
                {t('taskPerformance.individual', '')}
            </button>

            <button
                onClick={() => setViewMode('team')}
                className={`px-4 py-2 rounded-lg cursor-pointer ${text.primary} ${viewMode === 'team' ? 'bg-blue-600 text-white' : bg.secondary}`}
            >
                {t('taskPerformance.team', '')}
            </button>
          </div>

        )}
      </div>

      {/* Month Selector */}
      <div className={`cursor-pointer ${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigateMonth(-1)}
            className={`p-2 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
          >
            <ChevronLeft className={`w-5 h-5 ${text.primary}`} />
          </button>
          
          <div className="flex items-center space-x-2">
            <Calendar className={`w-5 h-5 ${text.secondary}`} />
            <span className={`text-lg font-semibold ${text.primary}`}>
              {formatMonth(selectedMonth)}
            </span>
          </div>

          <button
            onClick={() => navigateMonth(1)}
            className={`cursor-pointer p-2 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
            disabled={selectedMonth.getMonth() === new Date().getMonth() && selectedMonth.getFullYear() === new Date().getFullYear()}
          >
            <ChevronRight className={`w-5 h-5 ${text.primary}`} />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {viewMode === 'individual' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{monthlyStats.totalTasks}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.totalTasks', '')}</p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{monthlyStats.completedTasks}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.completed', '')}</p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Pickaxe className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{monthlyStats.inProgressTasks}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.inProgress', '')}</p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <TimerOff className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>{monthlyStats.overdueTasks}</span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.overdue', '')}</p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className={`w-5 h-5 ${text.secondary} ${monthlyStats.completionRate >= 70 ? text.secondary : text.warning}`} />
              <span className={`text-2xl font-bold ${text.primary} ${monthlyStats.completionRate >= 70 ? text.primary : text.warning}`}>
                {monthlyStats.completionRate}%
              </span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.completionRate', '')}</p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <div className="flex items-center justify-between mb-2">
              <Star className={`w-5 h-5 ${text.secondary}`} />
              <span className={`text-2xl font-bold ${text.primary}`}>
                {monthlyStats.avgQuality}
              </span>
            </div>
            <p className={`text-sm ${text.secondary}`}>{t('taskPerformance.avgQuality', '')}</p>
          </div>
        </div>
      )}

      {/* Additional Metrics */}
      {viewMode === 'individual' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <h3 className={`text-sm font-semibold ${text.primary} mb-3`}>{t('taskPerformance.onTimePerformance', 'On-Time Performance')}</h3>
            <div className="flex items-center justify-between">
              <span className={text.secondary}>{t('taskPerformance.onTimeCompletions', 'On-Time Completions')}</span>
              <span className={`font-semibold ${text.primary}`}>
                {monthlyStats.onTimeCompletions}/{monthlyStats.completedTasks}
              </span>
            </div>
            <div className="mt-2">
              <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div 
                  className={`h-2 rounded-full shadow-sm ${isDarkMode ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-green-500 to-green-600'}`}
                  style={{ width: `${monthlyStats.onTimeRate}%` }}
                ></div>
              </div>
              <p className={`text-xs ${text.secondary} mt-1`}>{monthlyStats.onTimeRate}% {t('taskPerformance.onTimeRate', 'on-time rate')}</p>
            </div>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <h3 className={`text-sm font-semibold ${text.primary} mb-3`}>{t('taskPerformance.priorityDistribution', 'Priority Distribution')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDarkMode ? 'text-red-200' : 'text-red-600'}`}>{t('workload.priorityHigh', 'High Priority')}</span>
                <span className={`font-semibold ${text.primary}`}>{monthlyStats.highPriority}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDarkMode ? 'text-yellow-200' : 'text-yellow-600'}`}>{t('workload.priorityMedium', 'Medium Priority')}</span>
                <span className={`font-semibold ${text.primary}`}>{monthlyStats.mediumPriority}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-600'}`}>{t('workload.priorityLow', 'Low Priority')}</span>
                <span className={`font-semibold ${text.primary}`}>{monthlyStats.lowPriority}</span>
              </div>
            </div>
          </div>

          <div className={`${bg.secondary} rounded-lg p-4 border ${border.primary}`}>
            <h3 className={`text-sm font-semibold ${text.primary} mb-3`}>{t('taskPerformance.qualityAssessment', 'Quality Assessment')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.ratedTasks', 'Rated Tasks')}</span>
                <span className={`font-semibold ${text.primary}`}>
                  {monthlyStats.ratedTasks}/{monthlyStats.totalTasks}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${text.secondary}`}>{t('taskPerformance.avgQuality', 'Avg Quality')}</span>
                <span className={`font-semibold ${getQualityColor(monthlyStats.avgQuality)}`}>
                  {monthlyStats.avgQuality}/5 ⭐
                </span>
              </div>
              <div className="mt-2">
                <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className={`h-2 rounded-full shadow-sm ${
                      monthlyStats.avgQuality >= 4 
                        ? isDarkMode ? 'bg-linear-to-r from-green-600 to-green-400' : 'bg-linear-to-r from-green-500 to-green-600'
                        : monthlyStats.avgQuality >= 3 
                        ? isDarkMode ? 'bg-linear-to-r from-blue-600 to-blue-400' : 'bg-linear-to-r from-blue-500 to-blue-600'
                        : isDarkMode ? 'bg-linear-to-r from-yellow-600 to-yellow-400' : 'bg-linear-to-r from-yellow-500 to-yellow-600'
                    }`}
                    style={{ width: `${(monthlyStats.avgQuality / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      {viewMode === 'individual' && 'team' && (
        <div className="flex items-center space-x-2">
          <Filter className={`w-5 h-5 ${text.secondary}`} />
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-lg text-sm ${text.secondary} ${filterStatus === 'all' ? 'bg-blue-600 text-white' : bg.secondary}`}
          >
            {t('taskPerformance.all', '')} ({tasks.length})
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1 rounded-lg text-sm ${text.secondary} ${filterStatus === 'completed' ? 'bg-green-600 text-white' : bg.secondary}`}
          >
            {t('taskPerformance.completed', '')} ({monthlyStats.completedTasks})
          </button>
          <button
            onClick={() => setFilterStatus('in-progress')}
            className={`px-3 py-1 rounded-lg text-sm ${text.secondary} ${filterStatus === 'in-progress' ? 'bg-blue-600 text-white' : bg.secondary}`}
          >
            {t('taskPerformance.inProgress', '')} ({monthlyStats.inProgressTasks})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1 rounded-lg text-sm ${text.secondary} ${filterStatus === 'pending' ? 'bg-gray-600 text-white' : bg.secondary}`}
          >
            {t('taskPerformance.pending', '')} ({monthlyStats.pendingTasks})
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'team' ? (
        <TeamView />
      ) : (
        <div className={`${bg.secondary} rounded-lg border ${border.primary}`}>
          <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {displayTasks.map(task => (
              <div className={`p-4 ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className={`font-semibold ${text.primary}`}>{task.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${text.primary} ${getStatusColor(task.status)}`}>
                        {getStatusText(task.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${text.primary} ${getPriorityColor(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </span>
                      {task.quality_rating > 0 && (
                        <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800'}`}>
                          ⭐ {task.quality_rating}/5
                        </span>
                      )}
                    </div>

                    <p className={`text-sm ${text.secondary} mb-2`}>{task.description}</p>

                    <div className="flex items-center space-x-4 text-xs">
                      {task.due_date && (
                        <span className={`flex items-center space-x-1 ${text.secondary}`}>
                          <Calendar className="w-3 h-3" />
                          <span>{t('taskPerformance.due', 'Due')}: {new Date(task.due_date).toLocaleDateString()}</span>
                        </span>
                      )}
                      {task.created_at && (
                        <span className={`flex items-center space-x-1 ${text.secondary}`}>
                          <Clock className="w-3 h-3" />
                          <span>{t('taskPerformance.created', 'Created')}: {new Date(task.created_at).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>

                    {/* Self Assessment */}
                    {task.self_assessment && (
                      <div className={`mt-3 p-3 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} rounded`}>
                        <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                          <MessageSquare className={`w-3 h-3 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                          <span>{t('taskPerformance.selfAssessment', 'Self Assessment')}:</span>
                        </p>
                        <p className={`text-sm ${text.secondary}`}>{task.self_assessment}</p>
                      </div>
                    )}

                    {/* Manager Comments */}
                    {task.comments && (
                      <div className={`mt-2 p-3 ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'} rounded`}>
                        <p className={`text-xs font-semibold ${text.primary} mb-1 flex items-center space-x-1`}>
                          <Award className={`w-3 h-3 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                          <span>{t('taskPerformance.managerEvaluation', 'Manager Evaluation')}:</span>
                        </p>
                        <p className={`text-sm ${text.secondary}`}>{task.comments}</p>
                      </div>
                    )}
                  </div>

                  {/* Evaluate Button */}
                  <button
                    onClick={() => openEvaluationModal(task)}
                    className={`ml-4 px-3 py-2 ${isDarkMode ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded flex items-center space-x-1 text-sm`}
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>{t('taskPerformance.evaluate', 'Evaluate')}</span>
                  </button>
                </div>
              </div>
            ))}

            {displayTasks.length === 0 && (
              <div className="p-8 text-center">
                <p className={text.secondary}>{t('taskPerformance.noTasks', 'No tasks found for this month')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      {evaluatingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className={`${bg.secondary} rounded-lg shadow-xl max-w-2xl w-full p-6`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`text-xl font-semibold ${text.primary}`}>
                  {t('taskPerformance.evaluateTask', 'Evaluate Task')}
                </h3>
                <p className={`text-sm ${text.secondary} mt-1`}>{evaluatingTask.title}</p>
              </div>
              <button
                onClick={closeEvaluationModal}
                className={`p-2 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
              >
                <X className={`w-5 h-5 ${text.primary}`} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Self Assessment - Available to task owner */}
              {evaluatingTask.employee_id === user?.employeeId && (
                <div>
                  <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                    Self Assessment
                  </label>
                  <textarea
                    value={evaluationForm.selfAssessment}
                    onChange={(e) => setEvaluationForm({ ...evaluationForm, selfAssessment: e.target.value })}
                    rows="3"
                    placeholder="How did you perform on this task? What challenges did you face?"
                    className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                  />
                </div>
              )}

              {/* Quality Rating - Available to admin/manager */}
              {canEvaluateOthers && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                      {t('taskPerformance.qualityRating', 'Quality Rating')} (1-5)
                    </label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => setEvaluationForm({ ...evaluationForm, qualityRating: rating })}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            evaluationForm.qualityRating >= rating
                              ? `border-yellow-500 ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`
                              : border.primary
                          }`}
                        >
                          <Star 
                            className={`w-6 h-6 ${
                              evaluationForm.qualityRating >= rating
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-400'
                            }`}
                          />
                        </button>
                      ))}
                      <span className={`ml-2 font-semibold ${text.primary}`}>
                        {evaluationForm.qualityRating}/5
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${text.primary} mb-2`}>
                      {t('taskPerformance.managerComments', 'Manager Comments')}
                    </label>
                    <textarea
                      value={evaluationForm.comments}
                      onChange={(e) => setEvaluationForm({ ...evaluationForm, comments: e.target.value })}
                      rows="3"
                      placeholder={t('taskPerformance.commentPlaceholder', 'Provide feedback on task quality and performance...')}
                      className={`w-full px-4 py-2 rounded-lg border ${border.primary}`}
                    />
                  </div>
                </>
              )}

              {/* Task Details */}
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-xs ${text.secondary} mb-2`}>{t('taskPerformance.taskDetails', 'Task Details')}:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className={text.secondary}>{t('taskPerformance.status', 'Status')}: </span>
                    <span className={`font-semibold ${text.primary}`}>{evaluatingTask.status}</span>
                  </div>
                  <div>
                    <span className={text.secondary}>{t('taskPerformance.priority', 'Priority')}: </span>
                    <span className={`font-semibold ${text.primary}`}>{evaluatingTask.priority}</span>
                  </div>
                  {evaluatingTask.due_date && (
                    <div>
                      <span className={text.secondary}>{t('taskPerformance.dueDate', 'Due Date')}: </span>
                      <span className={`font-semibold ${text.primary}`}>
                        {new Date(evaluatingTask.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {evaluatingTask.quality_rating > 0 && (
                    <div>
                      <span className={text.secondary}>Current Rating: </span>
                      <span className={`font-semibold ${text.primary}`}>
                        {evaluatingTask.quality_rating}/5 ⭐
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={closeEvaluationModal}
                className={`flex-1 px-4 py-2 border rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
              >
                {t('taskPerformance.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSubmitEvaluation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{t('taskPerformance.submitEvaluation', 'Submit Evaluation')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskPerformanceReview;
