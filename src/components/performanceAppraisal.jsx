import React, { useState, useEffect } from 'react';
import { Star, Sparkle, TrendingUp, Calendar, User, Award, Goal, MessageSquare, Plus, Edit, Eye, X, Save, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import * as performanceService from '../services/performanceService';

const PerformanceAppraisal = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id ? String(employees[0].id) : null);
  const [selectedPeriod, setSelectedPeriod] = useState('2024-q4');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [showReviewDetailModal, setShowReviewDetailModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewComments, setReviewComments] = useState([]);
  const [editingGoal, setEditingGoal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [progressChanges, setProgressChanges] = useState({}); // Track progress changes by goal ID
  const { t } = useLanguage();
  const { isDarkMode, text, bg, border } = useTheme();
  const { user } = useAuth();

  // Form state for new goal
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'general',
    targetDate: '',
    priority: 'medium',
    status: 'pending',
    progressPercentage: 0
  });

  // Form state for new review
  const [reviewForm, setReviewForm] = useState({
    reviewType: 'quarterly',
    reviewPeriod: '',
    overallRating: 5,
    technicalSkillsRating: 5,
    communicationRating: 5,
    leadershipRating: 5,
    teamworkRating: 5,
    problemSolvingRating: 5,
    strengths: '',
    areasForImprovement: '',
    achievements: '',
    comments: ''
  });

  // Fetch goals and reviews when employee changes
  useEffect(() => {
    if (selectedEmployee) {
      fetchGoalsAndReviews();
    }
  }, [selectedEmployee]);

  const fetchGoalsAndReviews = async () => {
    setLoading(true);
    try {
      // Fetch goals
      const goalsResult = await performanceService.getAllPerformanceGoals({
        employeeId: selectedEmployee
      });
      if (goalsResult.success) {
        setGoals(goalsResult.data || []);
      }

      // Fetch reviews
      const reviewsResult = await performanceService.getAllPerformanceReviews({
        employeeId: selectedEmployee
      });
      if (reviewsResult.success) {
        setReviews(reviewsResult.data || []);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handler to update employee performance rating
  const handleUpdatePerformanceRating = async (newRating) => {
    if (!selectedEmployee) return;
    
    try {
      // Import employeeService
      const { updateEmployee } = await import('../services/employeeService');
      
      const result = await updateEmployee(selectedEmployee, {
        performance: newRating
      });
      
      if (result.success) {
        // Show success notification
        alert(t('performance.ratingUpdated', 'Performance rating updated successfully!'));
        // Optionally refresh the employee data
        fetchGoalsAndReviews();
      } else {
        alert(t('performance.ratingUpdateError', 'Failed to update performance rating'));
      }
    } catch (error) {
      console.error('Error updating performance rating:', error);
      alert(t('performance.ratingUpdateError', 'Failed to update performance rating'));
    }
  };

  // Handlers for modals
  const handleAddGoal = () => {
    setGoalForm({
      title: '',
      description: '',
      category: 'general',
      targetDate: '',
      priority: 'medium',
      status: 'pending',
      progressPercentage: 0
    });
    setShowAddGoalModal(true);
  };

  const handleAddReview = () => {
    setReviewForm({
      reviewType: 'quarterly',
      reviewPeriod: '',
      overallRating: 5,
      technicalSkillsRating: 5,
      communicationRating: 5,
      leadershipRating: 5,
      teamworkRating: 5,
      problemSolvingRating: 5,
      strengths: '',
      areasForImprovement: '',
      achievements: '',
      comments: ''
    });
    setShowAddReviewModal(true);
  };

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await performanceService.createPerformanceGoal({
      employeeId: selectedEmployee,
      ...goalForm,
      assignedBy: selectedEmployee // Could be current user in real scenario
    });

    if (result.success) {
      setShowAddGoalModal(false);
      fetchGoalsAndReviews(); // Refresh data
      alert(t('performance.goalCreatedSuccess', 'Goal created successfully!'));
    } else {
      alert(t('performance.goalCreatedError', 'Failed to create goal: ') + result.error);
    }
    setLoading(false);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await performanceService.createPerformanceReview({
      employeeId: selectedEmployee,
      reviewerId: selectedEmployee, // Should be manager/reviewer ID
      ...reviewForm
    });

    if (result.success) {
      setShowAddReviewModal(false);
      fetchGoalsAndReviews(); // Refresh data
      alert(t('performance.reviewCreatedSuccess', 'Review created successfully!'));
    } else {
      alert(t('performance.reviewCreatedError', 'Failed to create review: ') + result.error);
    }
    setLoading(false);
  };

  const handleEditGoal = (goal) => {
    // Find the original goal from goals array to get all fields
    const originalGoal = goals.find(g => g.id === goal.id);
    if (originalGoal) {
      setEditingGoal(originalGoal);
      setGoalForm({
        title: originalGoal.title,
        description: originalGoal.description,
        category: originalGoal.category,
        targetDate: originalGoal.target_date,
        priority: originalGoal.priority,
        status: originalGoal.status,
        progressPercentage: originalGoal.progress_percentage || 0
      });
      setShowEditGoalModal(true);
    }
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    if (!editingGoal) return;
    
    setLoading(true);
    
    const result = await performanceService.updatePerformanceGoal(editingGoal.id, {
      ...goalForm,
      progress_percentage: goalForm.progressPercentage
    });

    if (result.success) {
      setShowEditGoalModal(false);
      setEditingGoal(null);
      fetchGoalsAndReviews(); // Refresh data
      alert(t('performance.goalUpdatedSuccess', 'Goal updated successfully!'));
    } else {
      alert(t('performance.goalUpdatedError', 'Failed to update goal: ') + result.error);
    }
    setLoading(false);
  };

  // Handle view review details
  const handleViewReview = (review) => {
    // Find the full review data from reviews array
    const fullReview = reviews.find(r => r.id === review.id);
    setSelectedReview(fullReview);
    setShowReviewDetailModal(true);
  };

  // Handle view comments
  const handleViewComments = async (review) => {
    const fullReview = reviews.find(r => r.id === review.id);
    setSelectedReview(fullReview);
    setLoading(true);
    
    try {
      // Fetch comments from performance_comments table
      const { supabase } = await import('../config/supabaseClient');
      const { data, error } = await supabase
        .from('performance_comments')
        .select(`
          *,
          commenter:employees!performance_comments_commenter_id_fkey(id, name, position)
        `)
        .eq('review_id', review.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReviewComments(data || []);
      setShowCommentsModal(true);
    } catch (error) {
      console.error('Error fetching comments:', error);
      alert(t('performance.errorFetchingComments', 'Error fetching comments'));
    } finally {
      setLoading(false);
    }
  };

  // Handle progress change
  const handleProgressChange = (goalId, newProgress) => {
    setProgressChanges(prev => ({
      ...prev,
      [goalId]: newProgress
    }));
  };

  // Save progress for a specific goal
  const handleSaveProgress = async (goalId) => {
    const newProgress = progressChanges[goalId];
    if (newProgress === undefined) return;

    setLoading(true);
    
    try {
      // Determine the new status based on progress
      let newStatus = 'pending';
      if (newProgress === 100) {
        newStatus = 'completed';
      } else if (newProgress > 0) {
        newStatus = 'in_progress';
      }
      
      // Update both progress and status in a single call
      const result = await performanceService.updatePerformanceGoal(goalId, {
        progressPercentage: newProgress,
        status: newStatus
      });

      if (result.success) {
        // Clear the progress change for this goal
        setProgressChanges(prev => {
          const updated = { ...prev };
          delete updated[goalId];
          return updated;
        });
        
        fetchGoalsAndReviews(); // Refresh data
        alert(t('performance.progressSaved', 'Progress saved successfully!'));
      } else {
        alert(t('performance.progressSaveError', 'Failed to save progress: ') + result.error);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      alert(t('performance.progressSaveError', 'Failed to save progress: ') + error.message);
    }
    
    setLoading(false);
  };

  // Calculate overall rating from reviews
  const calculateOverallRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + (review.overall_rating || 0), 0);
    return sum / reviews.length;
  };

  // Prepare current data from state
  const currentData = {
    overallRating: calculateOverallRating(),
    goals: goals.map(goal => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      progress: goal.progress_percentage || 0,
      deadline: goal.target_date,
      description: goal.description,
      category: goal.category,
      priority: goal.priority
    })),
    reviews: reviews.map(review => ({
      id: review.id,
      reviewer: review.reviewer?.name || 'Manager',
      rating: review.overall_rating || 0,
      date: review.review_date,
      type: review.review_type,
      strengths: review.strengths,
      areasForImprovement: review.areas_for_improvement
    })),
    skills: [] // Will be fetched separately if needed
  };

  const periods = [
    { value: '2024-q4', label: t('performance.q4_2024') },
    { value: '2024-q3', label: t('performance.q3_2024') },
    { value: '2024-q2', label: t('performance.q2_2024') },
    { value: '2024-q1', label: t('performance.q1_2024') }
  ];

  const StarRating = ({ rating, size = 'w-5 h-5', editable = false, onRatingChange }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [newRating, setNewRating] = useState(rating);

    const handleStarClick = (starValue) => {
      if (!editable) return;
      setNewRating(starValue);
      if (onRatingChange) {
        onRatingChange(starValue);
      }
    };

    const handleStarHover = (starValue) => {
      if (editable) {
        setHoverRating(starValue);
      }
    };

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= (hoverRating || newRating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
            } ${editable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => handleStarHover(star)}
            onMouseLeave={() => setHoverRating(0)}
          />
        ))}
        <span 
          className="ml-2 text-sm font-medium"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#d1d5db' : '#374151',
            borderColor: 'transparent'
          }}
        >
          {newRating.toFixed(1)}
        </span>
      </div>
    );
  };

  const ProgressBar = ({ progress, goalId, editable = false }) => {
    const [localProgress, setLocalProgress] = useState(progress);
    const [isHovering, setIsHovering] = useState(false);

    const handleProgressClick = async (e) => {
      if (!editable) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newProgress = Math.round((x / rect.width) * 100);
      
      setLocalProgress(newProgress);
      
      // Update in database
      if (goalId) {
        const result = await performanceService.updatePerformanceGoal(goalId, {
          progress_percentage: newProgress
        });
        
        if (result.success) {
          fetchGoalsAndReviews(); // Refresh data
        }
      }
    };

    return (
      <div 
        className={`w-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2 ${editable ? 'cursor-pointer' : ''}`}
        onClick={handleProgressClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        title={editable ? t('performance.clickToUpdateProgress', 'Click to update progress') : ''}
      >
        <div
          className="h-2 rounded-full transition-all"
          style={{ 
            width: `${localProgress}%`,
            background: `linear-gradient(to right, #000000, #c40000ff)`,
            boxShadow: isHovering && editable ? '0 0 6px rgba(220, 38, 38, 0.6)' : '0 0 4px rgba(220, 38, 38, 0.4)'
          }}
        ></div>
      </div>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return t('performance.completed');
      case 'in_progress': return t('performance.inProgress');
      case 'in-progress': return t('performance.inProgress');
      case 'pending': return t('performance.pending');
      default: return status;
    }
  };

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Overall Performance Card */}
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 
            className="text-lg font-semibold"
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: 'transparent'
            }}
          >
            {t('performance.overallPerformance')}
          </h3>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span 
              className="text-2xl font-bold"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: 'transparent'
              }}
            >
              {currentData.overallRating.toFixed(1)}
            </span>
            <span 
              className="text-gray-500"
              style={{
                backgroundColor: 'transparent',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                borderColor: 'transparent'
              }}
            >
              /5.0
            </span>
          </div>
        </div>
        <StarRating 
          rating={currentData.overallRating} 
          size="w-6 h-6" 
          editable={true}
          onRatingChange={handleUpdatePerformanceRating}
        />
        <p className={`text-xs mt-2 ${text.secondary}`}>
          {t('performance.clickToRate', '')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="rounded-lg shadow-sm border p-6"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-transparent rounded-full">
              <Goal className={`h-6 w-6 ${text.primary}`} />
            </div>
            <div>
              <p 
                className="text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#4b5563',
                  borderColor: 'transparent'
                }}
              >
                {t('performance.goalsCompleted')}
              </p>
              <p 
                className="text-2xl font-bold"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {currentData.goals.filter(g => g.status === 'completed').length}/{currentData.goals.length}
              </p>
            </div>
          </div>
        </div>

        <div 
          className="rounded-lg shadow-sm border p-6"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-transparent rounded-full">
              <Award className={`h-6 w-6 ${text.primary}`} />
            </div>
            <div>
              <p 
                className="text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#4b5563',
                  borderColor: 'transparent'
                }}
              >
                {t('performance.reviewsThisPeriod')}
              </p>
              <p 
                className="text-2xl font-bold"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {currentData.reviews.length}
              </p>
            </div>
          </div>
        </div>

        <div 
          className="rounded-lg shadow-sm border p-6"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-transparent rounded-full">
              <Sparkle className={`h-6 w-6 ${text.primary}`} />
            </div>
            <div>
              <p 
                className="text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#4b5563',
                  borderColor: 'transparent'
                }}
              >
                {t('performance.avgSkillRating')}
              </p>
              <p 
                className="text-2xl font-bold"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {currentData.skills.length > 0 
                  ? (currentData.skills.reduce((acc, skill) => acc + skill.rating, 0) / currentData.skills.length).toFixed(1)
                  : '0.0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Goals */}
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 
            className="text-lg font-semibold"
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: 'transparent'
            }}
          >
            {t('performance.currentGoals')}
          </h3>
          <button 
            onClick={handleAddGoal}
            className={`px-4 py-2 text-white rounded-lg ${isDarkMode ? 'bg-transparent' : 'bg-transparent'} flex items-center space-x-2 cursor-pointer transition-colors`}
            
          >
            <Plus className="h-4 w-4" />
            <span>{t('performance.addGoal')}</span>
          </button>
        </div>
        <div className="space-y-4">
          {currentData.goals.slice(0, 3).map(goal => (
            <div 
              key={goal.id} 
              className="border rounded-lg p-4"
              style={{
                backgroundColor: isDarkMode ? '#4b5563' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#111827',
                borderColor: isDarkMode ? '#6b7280' : '#d1d5db'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 
                  className="font-medium"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {goal.title}
                </h4>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                    {getStatusText(goal.status)}
                  </span>
                  <button 
                    className={`p-1.5 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded transition-colors border`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditGoal(goal);
                    }}
                    title={t('performance.editGoal', 'Edit goal')}
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mb-2">
                <ProgressBar progress={goal.progress} goalId={goal.id} editable={true} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span 
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#d1d5db' : '#4b5563',
                    borderColor: 'transparent'
                  }}
                >
                  {goal.progress}% {t('performance.complete')}
                </span>
                <span 
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#d1d5db' : '#4b5563',
                    borderColor: 'transparent'
                  }}
                >
                  {t('performance.due')}: {new Date(goal.deadline).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const GoalsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 
          className="text-lg font-semibold"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('performance.performanceGoals')}
        </h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleAddGoal}
            className="px-4 py-2 bg-transparent text-white rounded-lg flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t('performance.addNewGoal')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {currentData.goals.map(goal => (
          <div 
            key={goal.id} 
            className="rounded-lg shadow-sm border p-6"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Goal className="h-5 w-5 ${text.primary}" />
                <h4 
                  className="font-semibold"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {goal.title}
                </h4>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(goal.status)}`}>
                  {getStatusText(goal.status)}
                </span>
                <button 
                  className={`p-2 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded transition-colors border`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditGoal(goal);
                  }}
                  title={t('performance.editGoal', 'Edit goal')}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                  }}
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span 
                  className="text-sm font-medium"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#d1d5db' : '#374151',
                    borderColor: 'transparent'
                  }}
                >
                  {t('performance.progress')}
                </span>
                <span 
                  className="text-sm font-bold"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
                  }}
                >
                  {progressChanges[goal.id] !== undefined ? progressChanges[goal.id] : goal.progress}%
                </span>
              </div>
              
              {/* Interactive Progress Slider */}
              <div className="mb-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressChanges[goal.id] !== undefined ? progressChanges[goal.id] : goal.progress}
                  onChange={(e) => handleProgressChange(goal.id, parseInt(e.target.value))}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, 
                      #000000 0%, 
                      #dc2626 ${(progressChanges[goal.id] !== undefined ? progressChanges[goal.id] : goal.progress)}%, 
                      ${isDarkMode ? '#4b5563' : '#d1d5db'} ${(progressChanges[goal.id] !== undefined ? progressChanges[goal.id] : goal.progress)}%, 
                      ${isDarkMode ? '#4b5563' : '#d1d5db'} 100%)`
                  }}
                />
              </div>
              
              {/* Save Button - Only show if progress changed */}
              {progressChanges[goal.id] !== undefined && progressChanges[goal.id] !== goal.progress && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleSaveProgress(goal.id)}
                    disabled={loading}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-1 cursor-pointer transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-3 w-3" />
                    <span>{loading ? t('common.saving', 'Saving...') : t('common.save', 'Save Progress')}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span 
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
                  }}
                >
                  {t('performance.deadline')}: {new Date(goal.deadline).toLocaleDateString()}
                </span>
              </div>
              <button 
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 hidden"
                style={{
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  borderColor: 'transparent'
                }}
              >
                <Eye className="h-4 w-4" />
                <span>{t('performance.viewDetails')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ReviewsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 
          className="text-lg font-semibold"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('performance.performanceReviews')}
        </h3>
        <button 
          onClick={handleAddReview}
          className="px-4 py-2 rounded-lg flex items-center space-x-2 cursor-pointer transition-colors hover:border-gray-100"
        >
          <Plus className={`h-4 w-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`} />
          <span className={`${isDarkMode ? 'bg-transparent text-white' : 'bg-transparent text-gray-900'}`}>{t('performance.newReview')}</span>
        </button>
      </div>

      <div className="space-y-4">
        {currentData.reviews.map(review => (
          <div 
            key={review.id} 
            className="rounded-lg shadow-sm border p-6"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
                <div>
                  <h4 
                    className="font-semibold"
                    style={{
                      backgroundColor: 'transparent',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      borderColor: 'transparent'
                    }}
                  >
                    {review.type}
                  </h4>
                  <p 
                    className="text-sm"
                    style={{
                      backgroundColor: 'transparent',
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      borderColor: 'transparent'
                    }}
                  >
                    {t('performance.by')} {review.reviewer}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <StarRating rating={review.rating} size="w-4 h-4" />
                <p 
                  className="text-sm mt-1"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
                  }}
                >
                  {new Date(review.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-2">
              <button 
                onClick={() => handleViewReview(review)}
                className="px-3 py-1 text-sm border rounded cursor-pointer transition-colors"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#000000',           
                }}
              >
                {t('performance.viewFullReview')}
              </button>
              <button 
                onClick={() => handleViewComments(review)}
                className="px-3 py-1 text-sm flex items-center space-x-1 cursor-pointer transition-colors rounded"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#9ca3af' : '#6b7280',                 
                }}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{t('performance.comments')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Get current employee data
  const currentEmployee = employees.find(emp => String(emp.id) === selectedEmployee);

  return (
    <div className="space-y-4 md:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 gap-15">
        <div className="flex items-center space-x-4">
          <h2 
            className="font-bold"
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: 'transparent',
              fontSize: 'clamp(1.25rem, 3vw, 1.5rem)'
            }}
          >
            {t('performance.title')}
          </h2>
          {currentEmployee && (
            <div className="flex items-center space-x-3">
              {currentEmployee.photo ? (
                <img 
                  src={currentEmployee.photo} 
                  className={`w-10 h-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-blue-500`}>
                  {currentEmployee.name?.charAt(0) || 'U'}
                </div>
              )}
            
            </div>
          )}
        </div>
        <div className="flex space-x-4">
          {/* Employee Selector */}
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(String(e.target.value))}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            {employees.map(employee => (
              <option key={employee.id} value={String(employee.id)}>
                {employee.name}
              </option>
            ))}
          </select>

          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            {periods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div 
        className="border-b"
        style={{
          borderColor: isDarkMode ? '#4b5563' : '#e5e7eb'
        }}
      >
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: t('performance.overview') },
            { id: 'goals', name: t('performance.goalsTab') },
            { id: 'reviews', name: t('performance.reviewsTab') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500'
                  : `border-transparent hover:border-gray-300`
              }`}
              style={{
                color: activeTab === tab.id 
                  ? isDarkMode ? '#ffffff' : '#000000' 
                  : isDarkMode ? '#9ca3af' : '#6b7280',
                borderBottomColor: activeTab === tab.id 
                  ? '#2563eb' 
                  : 'transparent'
              }}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'goals' && <GoalsTab />}
      {activeTab === 'reviews' && <ReviewsTab />}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddGoalModal(false);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-3xl w-full p-6 my-8"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('performance.addNewGoal', 'Add New Goal')}</h2>
              <button
                onClick={() => setShowAddGoalModal(false)}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGoal} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('performance.goalTitle', 'Goal Title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({...goalForm, title: e.target.value})}
                  placeholder={t('performance.goalTitlePlaceholder', 'Enter goal title')}
                  className="w-full px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('performance.goalDescription', 'Description')}
                </label>
                <textarea
                  rows="3"
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                  placeholder={t('performance.goalDescriptionPlaceholder', 'Describe the goal objectives')}
                  className="w-full px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.category', 'Category')}
                  </label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({...goalForm, category: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="general">{t('performance.general', 'General')}</option>
                    <option value="technical">{t('performance.technical', 'Technical')}</option>
                    <option value="leadership">{t('performance.leadership', 'Leadership')}</option>
                    <option value="project">{t('performance.project', 'Project')}</option>
                    <option value="professional_development">{t('performance.professionalDevelopment', 'Professional Development')}</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.priority', 'Priority')}
                  </label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({...goalForm, priority: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="low">{t('performance.low', 'Low')}</option>
                    <option value="medium">{t('performance.medium', 'Medium')}</option>
                    <option value="high">{t('performance.high', 'High')}</option>
                    <option value="critical">{t('performance.critical', 'Critical')}</option>
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.targetDate', 'Target Date')}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={goalForm.targetDate}
                      onChange={(e) => setGoalForm({...goalForm, targetDate: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      style={{
                        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                        borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                        color: isDarkMode ? '#ffffff' : '#111827'
                      }}
                    />
                    <Calendar 
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                      style={{
                        color: isDarkMode ? '#9ca3af' : '#6b7280'
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.status', 'Status')}
                  </label>
                  <select
                    value={goalForm.status}
                    onChange={(e) => setGoalForm({...goalForm, status: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="pending">{t('performance.pending', 'Pending')}</option>
                    <option value="in_progress">{t('performance.inProgress', 'In Progress')}</option>
                    <option value="completed">{t('performance.completed', 'Completed')}</option>
                    <option value="cancelled">{t('performance.cancelled', 'Cancelled')}</option>
                    <option value="on_hold">{t('performance.onHold', 'On Hold')}</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t"
                style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddGoalModal(false)}
                  className={`px-4 py-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {showEditGoalModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditGoalModal(false);
              setEditingGoal(null);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-3xl w-full p-6 my-8"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('performance.editGoal', 'Edit Goal')}</h2>
              <button
                onClick={() => {
                  setShowEditGoalModal(false);
                  setEditingGoal(null);
                }}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGoal} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('performance.goalTitle', 'Goal Title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({...goalForm, title: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('performance.goalDescription', 'Description')}
                </label>
                <textarea
                  rows="3"
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                />
              </div>

              {/* Progress Percentage Slider */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('performance.progressPercentage', 'Progress')} 
                  <span className="ml-2 font-bold text-red-600">{goalForm.progressPercentage}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={goalForm.progressPercentage}
                  onChange={(e) => setGoalForm({...goalForm, progressPercentage: parseInt(e.target.value)})}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, 
                      #000000 0%, 
                      #4a0000 ${goalForm.progressPercentage * 0.5}%,
                      #dc2626 ${goalForm.progressPercentage}%, 
                      ${isDarkMode ? '#4b5563' : '#d1d5db'} ${goalForm.progressPercentage}%, 
                      ${isDarkMode ? '#4b5563' : '#d1d5db'} 100%)`
                  }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.category', 'Category')}
                  </label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({...goalForm, category: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="general">{t('performance.general', 'General')}</option>
                    <option value="technical">{t('performance.technical', 'Technical')}</option>
                    <option value="leadership">{t('performance.leadership', 'Leadership')}</option>
                    <option value="project">{t('performance.project', 'Project')}</option>
                    <option value="professional_development">{t('performance.professionalDevelopment', 'Professional Development')}</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.priority', 'Priority')}
                  </label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({...goalForm, priority: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="low">{t('performance.low', 'Low')}</option>
                    <option value="medium">{t('performance.medium', 'Medium')}</option>
                    <option value="high">{t('performance.high', 'High')}</option>
                    <option value="critical">{t('performance.critical', 'Critical')}</option>
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.targetDate', 'Target Date')}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={goalForm.targetDate}
                      onChange={(e) => setGoalForm({...goalForm, targetDate: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      style={{
                        backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                        borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                        color: isDarkMode ? '#ffffff' : '#111827'
                      }}
                    />
                    <Calendar 
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                      style={{
                        color: isDarkMode ? '#9ca3af' : '#6b7280'
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.status', 'Status')}
                  </label>
                  <select
                    value={goalForm.status}
                    onChange={(e) => setGoalForm({...goalForm, status: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="pending">{t('performance.pending', '')}</option>
                    <option value="in_progress">{t('performance.inProgress', '')}</option>
                    <option value="completed">{t('performance.completed', '')}</option>
                    <option value="cancelled">{t('performance.cancelled', '')}</option>
                    <option value="on_hold">{t('performance.onHold', '')}</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t"
                style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowEditGoalModal(false);
                    setEditingGoal(null);
                  }}
                  className={`px-4 py-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? t('common.updating', 'Updating...') : t('common.update', 'Update')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showAddReviewModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddReviewModal(false);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-3xl w-full p-6 my-8 h-[90%]"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('performance.newReview', 'New Performance Review')}</h2>
              <button
                onClick={() => setShowAddReviewModal(false)}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-6">
              {/* Review Type and Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.reviewType', 'Review Type')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={reviewForm.reviewType}
                    onChange={(e) => setReviewForm({...reviewForm, reviewType: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  >
                    <option value="quarterly">{t('performance.quarterly', '')}</option>
                    <option value="mid-year">{t('performance.midYear', '')}</option>
                    <option value="annual">{t('performance.annual', '')}</option>
                    <option value="probation">{t('performance.probation', '')}</option>
                    <option value="project">{t('performance.project', '')}</option>
                    <option value="ad-hoc">{t('performance.adHoc', '')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('performance.reviewPeriod', 'Review Period')}
                  </label>
                  <input
                    type="text"
                    value={reviewForm.reviewPeriod}
                    onChange={(e) => setReviewForm({...reviewForm, reviewPeriod: e.target.value})}
                    placeholder={t('performance.reviewPeriodPlaceholder', 'e.g., Q4 2024')}
                    className="w-full px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827'
                    }}
                  />
                </div>
              </div>

              {/* Rating Section */}
              <div className="border rounded-lg p-4" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                <h3 className="font-semibold mb-4">{t('performance.ratings', 'Ratings')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'overallRating', label: t('performance.overallRating', 'Overall Rating') },
                    { key: 'technicalSkillsRating', label: t('performance.technicalSkills', 'Technical Skills') },
                    { key: 'communicationRating', label: t('performance.communication', 'Communication') },
                    { key: 'leadershipRating', label: t('performance.leadership', 'Leadership') },
                    { key: 'teamworkRating', label: t('performance.teamwork', 'Teamwork') },
                    { key: 'problemSolvingRating', label: t('performance.problemSolving', 'Problem Solving') }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium mb-2">
                        {label}
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.5"
                          value={reviewForm[key]}
                          onChange={(e) => setReviewForm({...reviewForm, [key]: parseFloat(e.target.value)})}
                          className="flex-1"
                        />
                        <span className="font-bold w-12 text-right">{reviewForm[key].toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Text Areas */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('performance.strengths', 'Strengths')}
                  </label>
                  <textarea
                    rows="2"
                    value={reviewForm.strengths}
                    onChange={(e) => setReviewForm({...reviewForm, strengths: e.target.value})}
                    placeholder={t('performance.strengthsPlaceholder', 'List key strengths...')}
                    className="w-full px-3 py-2 rounded-lg border transition-colors resize-y"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      minHeight: '60px'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('performance.areasForImprovement', 'Areas for Improvement')}
                  </label>
                  <textarea
                    rows="2"
                    value={reviewForm.areasForImprovement}
                    onChange={(e) => setReviewForm({...reviewForm, areasForImprovement: e.target.value})}
                    placeholder={t('performance.areasForImprovementPlaceholder', 'Areas that need development...')}
                    className="w-full px-3 py-2 rounded-lg border transition-colors resize-y"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      minHeight: '60px'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('performance.achievements', 'Key Achievements')}
                  </label>
                  <textarea
                    rows="2"
                    value={reviewForm.achievements}
                    onChange={(e) => setReviewForm({...reviewForm, achievements: e.target.value})}
                    placeholder={t('performance.achievementsPlaceholder', 'Notable accomplishments during this period...')}
                    className="w-full px-3 py-2 rounded-lg border transition-colors resize-y"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      minHeight: '60px'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('performance.comments', 'Additional Comments')}
                  </label>
                  <textarea
                    rows="2"
                    value={reviewForm.comments}
                    onChange={(e) => setReviewForm({...reviewForm, comments: e.target.value})}
                    placeholder={t('performance.commentsPlaceholder', 'Any additional feedback...')}
                    className="w-full px-3 py-2 rounded-lg border transition-colors resize-y"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      minHeight: '60px'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t"
                style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddReviewModal(false)}
                  className={`px-4 py-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#ffffff' : '#111827'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? t('common.saving', 'Saving...') : t('common.save', 'Save Review')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Detail Modal */}
      {showReviewDetailModal && selectedReview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReviewDetailModal(false);
              setSelectedReview(null);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-4xl w-full p-6 my-8"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{t('performance.reviewDetails', 'Performance Review Details')}</h2>
                <p className="text-sm mt-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  {selectedReview.review_type} - {selectedReview.review_period}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowReviewDetailModal(false);
                  setSelectedReview(null);
                }}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Review Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
                <div>
                  <label className="text-sm font-medium" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('performance.reviewer', 'Reviewer')}
                  </label>
                  <p className="mt-1 font-semibold">{selectedReview.reviewer?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('performance.reviewDate', 'Review Date')}
                  </label>
                  <p className="mt-1 font-semibold">{new Date(selectedReview.review_date).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Ratings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('performance.ratings', 'Ratings')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    <span className="font-medium">{t('performance.overallRating', 'Overall Rating')}</span>
                    <div className="flex items-center space-x-2">
                      <Star className="h-5 w-5 text-yellow-400 fill-current" />
                      <span className="font-bold text-lg">{selectedReview.overall_rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  {selectedReview.technical_skills_rating && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                      <span className="font-medium">{t('performance.technicalSkills', 'Technical Skills')}</span>
                      <span className="font-bold">{selectedReview.technical_skills_rating.toFixed(1)}</span>
                    </div>
                  )}
                  {selectedReview.communication_rating && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                      <span className="font-medium">{t('performance.communication', 'Communication')}</span>
                      <span className="font-bold">{selectedReview.communication_rating.toFixed(1)}</span>
                    </div>
                  )}
                  {selectedReview.leadership_rating && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                      <span className="font-medium">{t('performance.leadership', 'Leadership')}</span>
                      <span className="font-bold">{selectedReview.leadership_rating.toFixed(1)}</span>
                    </div>
                  )}
                  {selectedReview.teamwork_rating && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                      <span className="font-medium">{t('performance.teamwork', 'Teamwork')}</span>
                      <span className="font-bold">{selectedReview.teamwork_rating.toFixed(1)}</span>
                    </div>
                  )}
                  {selectedReview.problem_solving_rating && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                      <span className="font-medium">{t('performance.problemSolving', 'Problem Solving')}</span>
                      <span className="font-bold">{selectedReview.problem_solving_rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strengths */}
              {selectedReview.strengths && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
                    <Award className="h-5 w-5 text-green-600" />
                    <span>{t('performance.strengths', 'Strengths')}</span>
                  </h3>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    <p className="whitespace-pre-wrap">{selectedReview.strengths}</p>
                  </div>
                </div>
              )}

              {/* Areas for Improvement */}
              {selectedReview.areas_for_improvement && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span>{t('performance.areasForImprovement', 'Areas for Improvement')}</span>
                  </h3>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    <p className="whitespace-pre-wrap">{selectedReview.areas_for_improvement}</p>
                  </div>
                </div>
              )}

              {/* Achievements */}
              {selectedReview.achievements && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
                    <Sparkle className="h-5 w-5 text-yellow-600" />
                    <span>{t('performance.achievements', 'Key Achievements')}</span>
                  </h3>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    <p className="whitespace-pre-wrap">{selectedReview.achievements}</p>
                  </div>
                </div>
              )}

              {/* Comments */}
              {selectedReview.comments && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                    <span>{t('performance.comments', 'Comments')}</span>
                  </h3>
                  <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                    <p className="whitespace-pre-wrap">{selectedReview.comments}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
              <button
                onClick={() => {
                  setShowReviewDetailModal(false);
                  setSelectedReview(null);
                }}
                className={`px-6 py-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && selectedReview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCommentsModal(false);
              setSelectedReview(null);
              setReviewComments([]);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-3xl w-full p-6 my-8"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center space-x-2">
                  <MessageSquare className="h-6 w-6" />
                  <span>{t('performance.reviewComments', 'Review Comments')}</span>
                </h2>
                <p className="text-sm mt-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  {selectedReview.review_type} - {selectedReview.review_period}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setSelectedReview(null);
                  setReviewComments([]);
                }}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : reviewComments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4" style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }} />
                  <p style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('performance.noComments', 'No comments yet')}
                  </p>
                </div>
              ) : (
                reviewComments.map(comment => (
                  <div 
                    key={comment.id}
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
                      borderColor: isDarkMode ? '#4b5563' : '#e5e7eb'
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                          {comment.commenter?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold">{comment.commenter?.name || t('common.unknown', 'Unknown')}</p>
                          <p className="text-xs" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                            {comment.commenter?.position || ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                        {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
                      {comment.comment_text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setSelectedReview(null);
                  setReviewComments([]);
                }}
                className={`px-6 py-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceAppraisal;
