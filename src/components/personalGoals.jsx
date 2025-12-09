import React, { useState, useEffect } from 'react';
import { Star, Sparkle, TrendingUp, Calendar, User, Award, Goal, ShieldEllipsis, MessageSquare, Plus, Edit, Eye, X, Save, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabaseClient';
import { isDemoMode, getDemoGoalTitle, getDemoGoalDescription, getDemoSkills, upsertDemoSkill } from '../utils/demoHelper';
import * as performanceService from '../services/performanceService';

const PersonalGoals = ({ employees }) => {
  const { t } = useLanguage();
  const { isDarkMode, text, bg, border } = useTheme();
  const { user, checkPermission } = useAuth();

  // Helper to compute the current year-quarter string, e.g. '2025-q4'
  const getCurrentQuarter = (date = new Date()) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const quarter = Math.floor(month / 3) + 1; // 1-4
    return `${year}-q${quarter}`;
  };

  // Check if user can view other employees' performance
  const canViewAllEmployees = checkPermission('canViewReports');

  // Filter employees based on role
  const availableEmployees = canViewAllEmployees
    ? employees
    : employees.filter(emp => String(emp.id) === String(user?.employeeId || user?.id));

  // Default the selected employee to the logged-in user's employee id (or user id)
  const defaultEmployeeId = user?.employeeId
    ? String(user.employeeId)
    : user?.id
    ? String(user.id)
    : (availableEmployees[0]?.id ? String(availableEmployees[0].id) : null);

  const [selectedEmployee, setSelectedEmployee] = useState(defaultEmployeeId);

  // If `user` or `availableEmployees` arrive after mount, ensure we pick the logged-in user
  useEffect(() => {
    if (!selectedEmployee) {
      const fallback = user?.employeeId
        ? String(user.employeeId)
        : user?.id
        ? String(user.id)
        : (availableEmployees[0]?.id ? String(availableEmployees[0].id) : null);
      if (fallback) setSelectedEmployee(fallback);
    }
  }, [user, availableEmployees]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentQuarter());
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [showViewGoalModal, setShowViewGoalModal] = useState(false);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progressChanges, setProgressChanges] = useState({}); // Track progress changes by goal ID

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

  // Helper functions to translate department and position values
  const translateDepartment = (department) => {
    if (!department) return '';
    return t(`departments.${department}`, department);
  };
  
  const translatePosition = (position) => {
    if (!position) return '';
    return t(`employeePosition.${position}`, position);
  };

  // Fetch goals and reviews when employee changes
  useEffect(() => {
    if (selectedEmployee) {
      fetchGoalsAndReviews();
    }
  }, [selectedEmployee]);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddGoalModal) {
          setShowAddGoalModal(false);
        } else if (showEditGoalModal) {
          setShowEditGoalModal(false);
        } else if (showViewGoalModal) {
          setShowViewGoalModal(false);
          setViewingGoal(null);
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleEscKey);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showAddGoalModal, showEditGoalModal, showViewGoalModal]);

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

      // Fetch skills assessments
      let skillsData = [];
      let skillsError = null;

      if (isDemoMode()) {
        // Use persisted demo skills from localStorage
        const allDemoSkills = getDemoSkills();
        // Filter by selected employee
        skillsData = allDemoSkills.filter(skill => 
          String(skill.employee_id) === String(selectedEmployee)
        );
        // If no skills for this employee yet, provide default demo skills
        if (skillsData.length === 0) {
          skillsData = [
            { id: `demo-skill-1-${selectedEmployee}`, employee_id: selectedEmployee, skill_name: 'React', skill_category: 'Technical', rating: 4, proficiency_level: 'advanced', assessment_date: '2023-01-01' },
            { id: `demo-skill-2-${selectedEmployee}`, employee_id: selectedEmployee, skill_name: 'Communication', skill_category: 'Soft Skills', rating: 5, proficiency_level: 'advanced', assessment_date: '2023-01-01' },
            { id: `demo-skill-3-${selectedEmployee}`, employee_id: selectedEmployee, skill_name: 'Project Management', skill_category: 'Management', rating: 3, proficiency_level: 'intermediate', assessment_date: '2023-01-01' }
          ];
        }
      } else {
        const { data, error } = await supabase
          .from('skills_assessments')
          .select('*')
          .eq('employee_id', selectedEmployee)
          .order('skill_category', { ascending: true });
        skillsData = data;
        skillsError = error;
      }

      if (!skillsError && skillsData) {
        setSkills(skillsData);
      } else {
        setSkills([]);
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
      // Round to 2 decimal places (to match DECIMAL(3,2) in database)
      const roundedRating = Math.round(newRating * 100) / 100;

      // Only update legacy employees.performance column
      const { updateEmployee } = await import('../services/employeeService');
      const result = await updateEmployee(selectedEmployee, {
        performance: roundedRating
      });

      if (result.success) {
        console.log('Performance rating updated in employees table');
        
        // Show success notification
        alert(t('personalGoals.ratingUpdated', 'Performance rating updated successfully!'));
        // Refresh the employee data
        fetchGoalsAndReviews();
      } else {
        alert(t('personalGoals.ratingUpdateError', 'Failed to update performance rating'));
      }
    } catch (error) {
      console.error('Error updating performance rating:', error);
      alert(t('personalGoals.ratingUpdateError', 'Failed to update performance rating'));
    }
  };

  // Handler to update skill rating
  const handleUpdateSkillRating = async (skillName, category, newRating) => {
    if (!selectedEmployee) return;
    
    try {
      const roundedRating = Math.round(newRating * 10) / 10;
      const proficiencyLevel = roundedRating >= 4 ? 'advanced' : roundedRating >= 3 ? 'intermediate' : 'beginner';
      
      // Update local state immediately for instant UI feedback
      setSkills(prevSkills => {
        const existingSkillIndex = prevSkills.findIndex(s => s.skill_name === skillName);
        
        if (existingSkillIndex >= 0) {
          // Update existing skill
          const updated = [...prevSkills];
          updated[existingSkillIndex] = {
            ...updated[existingSkillIndex],
            rating: roundedRating,
            proficiency_level: proficiencyLevel
          };
          return updated;
        } else {
          // Add new skill
          return [...prevSkills, {
            id: `demo-skill-${Date.now()}`,
            employee_id: selectedEmployee,
            skill_name: skillName,
            skill_category: category,
            rating: roundedRating,
            proficiency_level: proficiencyLevel,
            assessment_date: new Date().toISOString().split('T')[0]
          }];
        }
      });

      if (isDemoMode()) {
        // Persist demo skill rating to localStorage
        upsertDemoSkill({
          employee_id: selectedEmployee,
          skill_name: skillName,
          skill_category: category,
          rating: roundedRating,
          proficiency_level: proficiencyLevel,
          assessment_date: new Date().toISOString().split('T')[0]
        });
        return;
      }

      // Check if skill exists in database
      const { data: existing, error: fetchError } = await supabase
        .from('skills_assessments')
        .select('id')
        .eq('employee_id', selectedEmployee)
        .eq('skill_name', skillName)
        .single();

      if (existing && !fetchError) {
        // Update existing
        await supabase
          .from('skills_assessments')
          .update({
            rating: roundedRating,
            proficiency_level: roundedRating >= 4 ? 'advanced' : roundedRating >= 3 ? 'intermediate' : 'beginner',
            assessment_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new
        await supabase
          .from('skills_assessments')
          .insert({
            employee_id: selectedEmployee,
            skill_name: skillName,
            skill_category: category,
            rating: roundedRating,
            proficiency_level: roundedRating >= 4 ? 'advanced' : roundedRating >= 3 ? 'intermediate' : 'beginner',
            assessment_date: new Date().toISOString().split('T')[0]
          });
      }
    } catch (error) {
      console.error('Error updating skill rating:', error);
      // Revert local state on error
      fetchGoalsAndReviews();
    }
  };

  // Handler for viewing goal details
  const handleViewGoal = (goal) => {
    setViewingGoal(goal);
    setShowViewGoalModal(true);
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

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Use service for both demo and non-demo mode (service handles persistence)
      const result = await performanceService.createPerformanceGoal({
        employeeId: selectedEmployee,
        ...goalForm,
        assignedBy: selectedEmployee
      });

      if (result.success) {
        setShowAddGoalModal(false);
        fetchGoalsAndReviews(); // Refresh data
        alert(t('personalGoals.goalCreatedSuccess', 'Goal created successfully!'));
      } else {
        alert(t('personalGoals.goalCreatedError', 'Failed to create goal: ') + result.error);
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert(t('personalGoals.goalCreatedError', 'Failed to create goal: ') + error.message);
    }
    
    setLoading(false);
  };

  const handleEditGoal = (goal) => {
    // Find the original goal from goals array to get all fields
    const originalGoal = goals.find(g => g.id === goal.id);
    if (originalGoal) {
      setEditingGoal(originalGoal);
      setGoalForm({
        title: isDemoMode() ? getDemoGoalTitle(originalGoal, t) : originalGoal.title,
        description: isDemoMode() ? getDemoGoalDescription(originalGoal, t) : originalGoal.description,
        category: originalGoal.category,
        targetDate: originalGoal.target_date,
        priority: originalGoal.priority,
        status: originalGoal.status,
        progressPercentage: originalGoal.progress || 0
      });
      setShowEditGoalModal(true);
    }
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    if (!editingGoal) return;
    
    setLoading(true);
    
    try {
      // Use service for both demo and non-demo mode (service handles persistence)
      const result = await performanceService.updatePerformanceGoal(editingGoal.id, {
        ...goalForm,
        progressPercentage: goalForm.progressPercentage
      });

      if (result.success) {
        setShowEditGoalModal(false);
        setEditingGoal(null);
        fetchGoalsAndReviews(); // Refresh data
        alert(t('personalGoals.goalUpdatedSuccess', 'Goal updated successfully!'));
      } else {
        alert(t('personalGoals.goalUpdatedError', 'Failed to update goal: ') + result.error);
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert(t('personalGoals.goalUpdatedError', 'Failed to update goal: ') + error.message);
    }
    
    setLoading(false);
  };

  // Handle delete goal
  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm(t('personalGoals.confirmDeleteGoal', 'Are you sure you want to delete this goal?'))) {
      return;
    }

    setLoading(true);
    
    try {
      const result = await performanceService.deletePerformanceGoal(goalId);

      if (result.success) {
        fetchGoalsAndReviews(); // Refresh data
        alert(t('personalGoals.goalDeletedSuccess', 'Goal deleted successfully!'));
      } else {
        alert(t('personalGoals.goalDeletedError', 'Failed to delete goal: ') + result.error);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert(t('personalGoals.goalDeletedError', 'Failed to delete goal: ') + error.message);
    }
    
    setLoading(false);
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
      
      // Use service for both demo and non-demo mode (service handles persistence)
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
        alert(t('personalGoals.progressSaved', 'Progress saved successfully!'));
      } else {
        alert(t('personalGoals.progressSaveError', 'Failed to save progress: ') + result.error);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      alert(t('personalGoals.progressSaveError', 'Failed to save progress: ') + error.message);
    }
    
    setLoading(false);
  };

  // Calculate overall rating from reviews
  const calculateOverallRating = () => {
    // Calculate average from skills assessments
    const skillNames = ['Technical Skills', 'Communication', 'Leadership', 'Teamwork', 'Problem Solving'];
    const skillRatings = skillNames
      .map(name => skills.find(s => s.skill_name === name))
      .filter(skill => skill && skill.rating > 0)
      .map(skill => skill.rating);
    
    if (skillRatings.length === 0) return 0;
    return skillRatings.reduce((sum, rating) => sum + rating, 0) / skillRatings.length;
  };

  // Prepare current data from state
  const currentData = {
    overallRating: calculateOverallRating(),
    goals: goals.map(goal => ({
      id: goal.id,
      title: isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title,
      status: goal.status,
      progress: goal.progress || 0,
      deadline: goal.target_date,
      description: isDemoMode() ? getDemoGoalDescription(goal, t) : goal.description,
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
    skills: skills
  };

  // Generate period options for the current year (Q1..Q4).
  // Labels use translation keys if available, otherwise fall back to "<year> Q<quarter>".
  const currentYear = new Date().getFullYear();
  const periods = [1, 2, 3, 4].map(q => ({
    value: `${currentYear}-q${q}`,
    label: t(`personalGoals.q${q}_${currentYear}`, `${currentYear} Q${q}`)
  }));

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
              star <= (hoverRating || newRating) ? `${text.primary} fill-current` : 'text-gray-300'
            } ${editable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => handleStarHover(star)}
            onMouseLeave={() => setHoverRating(0)}
          />
        ))}
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
      case 'completed': return t('personalGoals.completed');
      case 'achieved': return t('personalGoals.achieved');
      case 'in_progress': return t('personalGoals.inProgress');
      case 'in-progress': return t('personalGoals.inProgress');
      case 'pending': return t('personalGoals.pending');
      case 'not-started': return t('personalGoals.notStarted');
      default: return status;
    }
  };

  const getReviewTypeText = (reviewType) => {
    switch (reviewType) {
      case 'quarterly': return t('personalGoals.quarterly');
      case 'weekly': return t('personalGoals.weekly');
      case 'monthly': return t('personalGoals.monthly');
      case 'annual': return t('personalGoals.annual');
      case 'mid-year': return t('personalGoals.midYear');
      case 'probation': return t('personalGoals.probation');
      case 'ad-hoc': return t('personalGoals.adHoc');
      default: return reviewType;
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
            {t('personalGoals.overallPerformance')}
          </h3>
         
        </div>
        <StarRating 
          rating={currentData.overallRating} 
          size="w-6 h-6" 
          editable={false}
        />
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
              <ShieldEllipsis className={`h-6 w-6 ${text.primary}`} />
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
                {t('personalGoals.goalsInProgress', 'Goals In Progress')}
              </p>
              <p 
                className="text-2xl font-bold"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: 'transparent'
                }}
              >
                {currentData.goals.filter(g => g.status === 'in_progress' || g.status === 'in-progress').length}
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
                {t('personalGoals.avgSkillRating')}
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
                {t('personalGoals.goalsCompleted')}
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
      </div>

      {/* Individual Skills Rating */}
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <h3 
          className="text-lg font-semibold mb-4"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('personalGoals.skillsAssessment')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'technicalSkills', label: t('personalGoals.technical', 'Technical Skills'), category: 'technical', skillName: 'Technical Skills' },
            { key: 'communication', label: t('personalGoals.communication', 'Communication'), category: 'communication', skillName: 'Communication' },
            { key: 'leadership', label: t('personalGoals.leadership', 'Leadership'), category: 'leadership', skillName: 'Leadership' },
            { key: 'teamwork', label: t('personalGoals.teamwork', 'Teamwork'), category: 'teamwork', skillName: 'Teamwork' },
            { key: 'problemSolving', label: t('personalGoals.problemSolving', 'Problem Solving'), category: 'problem_solving', skillName: 'Problem Solving' }
          ].map(({ key, label, category, skillName }) => {
            const skill = currentData.skills.find(s => s.skill_name === skillName);
            const currentRating = skill?.rating || 0;
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{label}</label>
                  <span className="text-sm font-semibold">{currentRating.toFixed(1)}/5.0</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={currentRating}
                  onChange={(e) => {
                    const newRating = parseFloat(e.target.value);
                    handleUpdateSkillRating(skillName, category, newRating);
                  }}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #9f9f9f 0%, #9f9f9f 2.5%, ${isDarkMode ? '#ffffff' : '#374151'} ${(currentRating / 5) * 100}%, ${isDarkMode ? '#4b5563' : '#e5e7eb'} ${(currentRating / 5) * 100}%, ${isDarkMode ? '#4b5563' : '#e5e7eb'} 100%)`
                    }}
                 />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{t('personalGoals.beginner', 'Beginner')}</span>
                  <span>{t('personalGoals.advanced', 'Advanced')}</span>
                </div>
              </div>
            );
          })}
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
            {t('personalGoals.currentGoals')}
          </h3>
          <button 
            onClick={handleAddGoal}
            className={`px-4 py-2 text-white rounded-lg ${isDarkMode ? 'bg-transparent' : 'bg-transparent'} flex items-center space-x-2 cursor-pointer transition-colors`}
            
          >
            <Plus className={`h-4 w-4 ${text.secondary}`} />
            <span style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>{t('personalGoals.addGoal')}</span>
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
                  {isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title}
                </h4>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                    {getStatusText(goal.status)}
                  </span>
                  <button 
                    className={`cursor-pointer ${isDarkMode ? 'hover:bg-gray-50' : 'hover:bg-gray-800'} rounded transition-colors border`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditGoal(goal);
                    }}
                    title={t('personalGoals.editGoal', 'Edit goal')}
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                      color: isDarkMode ? '#ffffff' : '#111827',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }}
                  >
                    <Edit className={`h-4.5 w-4.5 ${text.secondary}`} />
                  </button>
                  <button 
                    className={`cursor-pointer ${isDarkMode ? 'hover:bg-red-900' : 'hover:bg-red-100'} rounded transition-colors border`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGoal(goal.id);
                    }}
                    title={t('personalGoals.deleteGoal', 'Delete goal')}
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                      color: isDarkMode ? '#f87171' : '#dc2626',
                      borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                    }}
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
          
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <span 
                    style={{
                      backgroundColor: 'transparent',
                      color: isDarkMode ? '#d1d5db' : '#4b5563',
                      borderColor: 'transparent'
                    }}
                  >
                    {goal.progress}% {t('personalGoals.complete')}
                  </span>
                  <span 
                    style={{
                      backgroundColor: 'transparent',
                      color: isDarkMode ? '#d1d5db' : '#4b5563',
                      borderColor: 'transparent'
                    }}
                  >
                    | {t('personalGoals.due')}: {new Date(goal.deadline).toLocaleDateString()}
                  </span>
                </div>
                <button 
                  onClick={() => handleViewGoal(goal)}
                  className="flex items-center space-x-1 px-2 py-1 rounded transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#60a5fa' : '#2563eb',
                    borderColor: 'transparent'
                  }}
                  title={t('personalGoals.viewDetails', 'View Details')}
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{t('personalGoals.viewDetails', 'View Details')}</span>
                </button>
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
          {t('personalGoals.performanceGoals')}
        </h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleAddGoal}
            className="px-4 py-2 bg-transparent text-white rounded-lg flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Plus className={`h-4 w-4 ${text.secondary}`} />
            <span>{t('personalGoals.addNewGoal')}</span>
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
                <Goal className={`h-5 w-5 ${text.secondary}`} />
                <h4 
                  className="font-semibold"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {isDemoMode() ? getDemoGoalTitle(goal, t) : goal.title}
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
                  title={t('personalGoals.editGoal', 'Edit goal')}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                  }}
                >
                  <Edit className={`h-4 w-4 ${text.secondary}`} />
                </button>
                <button 
                  className={`p-2 ${isDarkMode ? 'hover:bg-red-900' : 'hover:bg-red-100'} rounded transition-colors border`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteGoal(goal.id);
                  }}
                  title={t('personalGoals.deleteGoal', 'Delete goal')}
                  style={{
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                    color: isDarkMode ? '#f87171' : '#dc2626',
                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                  }}
                >
                  <Trash2 className="h-4 w-4" />
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
                  {t('personalGoals.progress')}
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
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className={`h-4 w-4 ${text.secondary}`} />
                <span 
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
                  }}
                >
                  {t('personalGoals.deadline')}: {new Date(goal.deadline).toLocaleDateString()}
                </span>
              </div>
              <button 
                onClick={() => handleViewGoal(goal)}
                className="flex items-center space-x-1 px-2 py-1 rounded transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#60a5fa' : '#2563eb',
                  borderColor: 'transparent'
                }}
                title={t('personalGoals.viewDetails', 'View Details')}
              >
                <Eye className="h-4 w-4" />
                <span className="text-sm">{t('personalGoals.viewDetails', 'View Details')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const currentEmployee = availableEmployees.find(emp => String(emp.id) === selectedEmployee);

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
            {t('personalGoals.title')}
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
          {/* Employee Selector - Only show for admin/manager */}
          {canViewAllEmployees && availableEmployees.length > 1 && (
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
              {availableEmployees.map(employee => (
                <option key={employee.id} value={String(employee.id)}>
                  {employee.name} • {translateDepartment(employee.department)} • {translatePosition(employee.position)}
                </option>
              ))}
            </select>
          )}

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
            { id: 'overview', name: t('personalGoals.overview') },
            { id: 'goals', name: t('personalGoals.goalsTab') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-500'
                  : `border-transparent hover:border-gray-300`
              }`}
              style={{
                color: activeTab === tab.id 
                  ? isDarkMode ? '#ffffff' : '#9f9f9f' 
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

      {/* Add New Goal Modal */}
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
              <h2 className="text-2xl font-bold">{t('personalGoals.addNewGoal', 'Add New Goal')}</h2>
              <button
                onClick={() => setShowAddGoalModal(false)}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className={`h-5 w-5 ${text.secondary}`} />
              </button>
            </div>

            <form onSubmit={handleSubmitGoal} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('personalGoals.goalTitle', 'Goal Title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({...goalForm, title: e.target.value})}
                  placeholder={t('personalGoals.goalTitlePlaceholder', 'Enter goal title')}
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
                  {t('personalGoals.goalDescription', 'Description')}
                </label>
                <textarea
                  rows="3"
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                  placeholder={t('personalGoals.goalDescriptionPlaceholder', 'Describe the goal objectives')}
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
                    {t('personalGoals.category', 'Category')}
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
                    <option value="general">{t('personalGoals.general', 'General')}</option>
                    <option value="technical">{t('personalGoals.technical', 'Technical')}</option>
                    <option value="leadership">{t('personalGoals.leadership', 'Leadership')}</option>
                    <option value="project">{t('personalGoals.project', 'Project')}</option>
                    <option value="professional_development">{t('personalGoals.professionalDevelopment', 'Professional Development')}</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('personalGoals.priority', 'Priority')}
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
                    <option value="low">{t('personalGoals.low', 'Low')}</option>
                    <option value="medium">{t('personalGoals.medium', 'Medium')}</option>
                    <option value="high">{t('personalGoals.high', 'High')}</option>
                    <option value="critical">{t('personalGoals.critical', 'Critical')}</option>
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('personalGoals.targetDate', 'Target Date')}
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
                    {t('personalGoals.status', 'Status')}
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
                    <option value="pending">{t('personalGoals.pending', 'Pending')}</option>
                    <option value="in_progress">{t('personalGoals.inProgress', 'In Progress')}</option>
                    <option value="completed">{t('personalGoals.completed', 'Completed')}</option>
                    <option value="cancelled">{t('personalGoals.cancelled', 'Cancelled')}</option>
                    <option value="on_hold">{t('personalGoals.onHold', 'On Hold')}</option>
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
                  <Save className={`h-4 w-4 ${isDarkMode ? 'text-white' : 'text-white'}`} />
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
              <h2 className="text-2xl font-bold">{t('personalGoals.title', 'Edit Goal')}</h2>
              <button
                onClick={() => {
                  setShowEditGoalModal(false);
                  setEditingGoal(null);
                }}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X className={`h-5 w-5 ${text.secondary}`} />
              </button>
            </div>

            <form onSubmit={handleUpdateGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('personalGoals.goalTitle', 'Goal Title')} <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('personalGoals.goalDescription', 'Description')}
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
            
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('personalGoals.progress', 'Progress')} 
                  <span className="ml-2 font-bold text-red-600">{goalForm.progressPercentage}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={goalForm.progressPercentage}
                  onChange={(e) => setGoalForm({...goalForm, progressPercentage: parseFloat(e.target.value)})}
                  className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${goalForm.progressPercentage === 100 ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={goalForm.progressPercentage === 100}
                  style={{
                    background: `linear-gradient(to right,
                      ${isDarkMode ? '#6b7280' : '#9f9f9f'} 0%,
                      ${isDarkMode ? '#6b7280' : '#9f9f9f'} 2.5%,
                      ${isDarkMode ? '#ffffff' : '#374151'} ${goalForm.progressPercentage}%,
                      ${isDarkMode ? '#4b5563' : '#e5e7eb'} ${goalForm.progressPercentage}%,
                      ${isDarkMode ? '#4b5563' : '#e5e7eb'} 100%)`
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
                    {t('personalGoals.category', 'Category')}
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
                    <option value="general">{t('personalGoals.general', 'General')}</option>
                    <option value="technical">{t('personalGoals.technical', 'Technical')}</option>
                    <option value="leadership">{t('personalGoals.leadership', 'Leadership')}</option>
                    <option value="project">{t('personalGoals.project', 'Project')}</option>
                    <option value="professional_development">{t('personalGoals.professionalDevelopment', 'Professional Development')}</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('personalGoals.priority', 'Priority')}
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
                    <option value="low">{t('personalGoals.low', 'Low')}</option>
                    <option value="medium">{t('personalGoals.medium', 'Medium')}</option>
                    <option value="high">{t('personalGoals.high', 'High')}</option>
                    <option value="critical">{t('personalGoals.critical', 'Critical')}</option>
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('personalGoals.targetDate', 'Target Date')}
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
                    {t('personalGoals.status', 'Status')}
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
                    <option value="pending">{t('personalGoals.pending', '')}</option>
                    <option value="in_progress">{t('personalGoals.inProgress', '')}</option>
                    <option value="completed">{t('personalGoals.completed', '')}</option>
                    <option value="cancelled">{t('personalGoals.cancelled', '')}</option>
                    <option value="on_hold">{t('personalGoals.onHold', '')}</option>
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
                  <Save className={`h-4 w-4 ${isDarkMode ? 'text-white' : 'text-white'}`} />
                  <span>{loading ? t('common.updating', 'Updating...') : t('common.update', '')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Goal Modal */}
      {showViewGoalModal && viewingGoal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowViewGoalModal(false);
              setViewingGoal(null);
            }
          }}
        >
          <div 
            className="rounded-lg shadow-xl max-w-2xl w-full my-8"
            style={{
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b"
              style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
            >
              <div className="flex items-center space-x-3">
                <Goal className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-bold">{t('personalGoals.goalDetails', 'Goal Details')}</h2>
              </div>
              <button
                onClick={() => {
                  setShowViewGoalModal(false);
                  setViewingGoal(null);
                }}
                className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
              >
                <X className="h-5 w-5" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {isDemoMode() ? getDemoGoalTitle(viewingGoal, t) : viewingGoal.title}
                </h3>
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  viewingGoal.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  viewingGoal.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                  viewingGoal.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {t(`personalGoals.${viewingGoal.status}`, viewingGoal.status)}
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  {t('personalGoals.goalDescription', 'Description')}
                </label>
                <p className="text-base leading-relaxed whitespace-pre-wrap" 
                  style={{ 
                    backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    color: isDarkMode ? '#e5e7eb' : '#374151'
                  }}
                >
                  {isDemoMode() ? getDemoGoalDescription(viewingGoal, t) : (viewingGoal.description || t('common.noDescription', 'No description available'))}
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('personalGoals.category', 'Category')}
                  </label>
                  <p className="font-medium capitalize">{t(`personalGoals.${viewingGoal.category}`, viewingGoal.category)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('personalGoals.priority', 'Priority')}
                  </label>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                    viewingGoal.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    viewingGoal.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {t(`personalGoals.${viewingGoal.priority}`, viewingGoal.priority)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('personalGoals.deadline', 'Deadline')}
                  </label>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-2" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }} />
                    {viewingGoal.deadline ? new Date(viewingGoal.deadline).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {t('personalGoals.progress', 'Progress')}
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-600">
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${viewingGoal.progress || 0}%` }}
                      />
                    </div>
                    <span className="font-bold text-sm">{viewingGoal.progress || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t"
              style={{ borderColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}
            >
              <button
                onClick={() => {
                  setShowViewGoalModal(false);
                  setViewingGoal(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
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

export default PersonalGoals;
