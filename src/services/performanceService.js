import { supabase } from '../config/supabaseClient';
import { isDemoMode, getDemoGoals, addDemoGoal, updateDemoGoal, deleteDemoGoal, MOCK_GOALS, MOCK_PERFORMANCE_REVIEWS, MOCK_SKILLS, MOCK_FEEDBACK, getDemoReviews, addDemoReview, updateDemoReview, deleteDemoReview, getDemoSkills, addDemoSkill, updateDemoSkill, upsertDemoSkill, deleteDemoSkill } from '../utils/demoHelper';

const toEmployeeId = (id) => {
  return id ? String(id) : null;
};

// ============================================
// PERFORMANCE REVIEWS
// ============================================

export const createPerformanceReview = async (reviewData) => {
  if (isDemoMode()) {
    const newReview = {
      id: `review-demo-${Date.now()}`,
      employee_id: reviewData.employeeId,
      reviewer_id: reviewData.reviewerId,
      review_period: reviewData.reviewPeriod,
      review_type: reviewData.reviewType || 'quarterly',
      overall_rating: reviewData.overallRating || null,
      technical_skills_rating: reviewData.technicalSkillsRating || null,
      communication_rating: reviewData.communicationRating || null,
      leadership_rating: reviewData.leadershipRating || null,
      teamwork_rating: reviewData.teamworkRating || null,
      problem_solving_rating: reviewData.problemSolvingRating || null,
      strengths: reviewData.strengths || null,
      areas_for_improvement: reviewData.areasForImprovement || null,
      achievements: reviewData.achievements || null,
      comments: reviewData.comments || null,
      status: reviewData.status || 'draft',
      review_date: reviewData.reviewDate || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    // Persist to localStorage
    addDemoReview(newReview);
    return { success: true, data: newReview };
  }

  try {
    const { data, error } = await supabase
      .from('performance_reviews')
      .insert([{
        employee_id: toEmployeeId(reviewData.employeeId),
        reviewer_id: toEmployeeId(reviewData.reviewerId),
        review_period: reviewData.reviewPeriod,
        review_type: reviewData.reviewType || 'quarterly',
        overall_rating: reviewData.overallRating || null,
        technical_skills_rating: reviewData.technicalSkillsRating || null,
        communication_rating: reviewData.communicationRating || null,
        leadership_rating: reviewData.leadershipRating || null,
        teamwork_rating: reviewData.teamworkRating || null,
        problem_solving_rating: reviewData.problemSolvingRating || null,
        strengths: reviewData.strengths || null,
        areas_for_improvement: reviewData.areasForImprovement || null,
        achievements: reviewData.achievements || null,
        comments: reviewData.comments || null,
        employee_comments: reviewData.employeeComments || null,
        goals_met: reviewData.goalsMet || 0,
        goals_total: reviewData.goalsTotal || 0,
        status: reviewData.status || 'draft',
        review_date: reviewData.reviewDate || new Date().toISOString().split('T')[0],
        due_date: reviewData.dueDate || null
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating performance review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all performance reviews
 */
export const getAllPerformanceReviews = async (filters = {}) => {
  if (isDemoMode()) {
    let reviews = getDemoReviews();
    
    if (filters.employeeId) {
      reviews = reviews.filter(r => String(r.employee_id) === String(filters.employeeId));
    }
    if (filters.reviewPeriod) {
      reviews = reviews.filter(r => r.review_period === filters.reviewPeriod);
    }
    if (filters.status) {
      reviews = reviews.filter(r => r.status === filters.status);
    }
    
    return { success: true, data: reviews };
  }

  try {
    let query = supabase
      .from('performance_reviews')
      .select(`
        *,
        employee:employees!performance_reviews_employee_id_fkey(id, name, position, department),
        reviewer:employees!performance_reviews_reviewer_id_fkey(id, name, position)
      `)
      .order('review_date', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', toEmployeeId(filters.employeeId));
    }
    if (filters.reviewPeriod) {
      query = query.eq('review_period', filters.reviewPeriod);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching performance reviews:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get review by ID
 */
export const getPerformanceReviewById = async (reviewId) => {
  if (isDemoMode()) {
    const review = getDemoReviews().find(r => r.id === reviewId);
    return { success: true, data: review || null };
  }

  try {
    const { data, error } = await supabase
      .from('performance_reviews')
      .select(`
        *,
        employee:employees!performance_reviews_employee_id_fkey(id, name, position, department, email),
        reviewer:employees!performance_reviews_reviewer_id_fkey(id, name, position)
      `)
      .eq('id', reviewId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching performance review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update performance review
 */
export const updatePerformanceReview = async (reviewId, updates) => {
  if (isDemoMode()) {
    const updatedReview = updateDemoReview(reviewId, updates);
    if (updatedReview) {
      return { success: true, data: updatedReview };
    }
    return { success: false, error: 'Review not found' };
  }

  try {
    const updateData = {};
    
    if (updates.reviewPeriod !== undefined) updateData.review_period = updates.reviewPeriod;
    if (updates.reviewType !== undefined) updateData.review_type = updates.reviewType;
    if (updates.overallRating !== undefined) updateData.overall_rating = updates.overallRating;
    if (updates.technicalSkillsRating !== undefined) updateData.technical_skills_rating = updates.technicalSkillsRating;
    if (updates.communicationRating !== undefined) updateData.communication_rating = updates.communicationRating;
    if (updates.leadershipRating !== undefined) updateData.leadership_rating = updates.leadershipRating;
    if (updates.teamworkRating !== undefined) updateData.teamwork_rating = updates.teamworkRating;
    if (updates.problemSolvingRating !== undefined) updateData.problem_solving_rating = updates.problemSolvingRating;
    if (updates.strengths !== undefined) updateData.strengths = updates.strengths;
    if (updates.areasForImprovement !== undefined) updateData.areas_for_improvement = updates.areasForImprovement;
    if (updates.achievements !== undefined) updateData.achievements = updates.achievements;
    if (updates.comments !== undefined) updateData.comments = updates.comments;
    if (updates.employeeComments !== undefined) updateData.employee_comments = updates.employeeComments;
    if (updates.goalsMet !== undefined) updateData.goals_met = updates.goalsMet;
    if (updates.goalsTotal !== undefined) updateData.goals_total = updates.goalsTotal;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.reviewDate !== undefined) updateData.review_date = updates.reviewDate;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    
    // Set timestamps based on status
    if (updates.status === 'submitted' && !updates.submittedAt) {
      updateData.submitted_at = new Date().toISOString();
    }
    if (updates.status === 'approved' && !updates.approvedAt) {
      updateData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('performance_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating performance review:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete performance review
 */
export const deletePerformanceReview = async (reviewId) => {
  if (isDemoMode()) {
    deleteDemoReview(reviewId);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('performance_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting performance review:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// PERFORMANCE GOALS
// ============================================

/**
 * Create a new goal
 */
export const createPerformanceGoal = async (goalData) => {
  if (isDemoMode()) {
    const newGoal = {
      id: `goal-demo-${Date.now()}`,
      employee_id: goalData.employeeId,
      title: goalData.title,
      description: goalData.description || null,
      category: goalData.category || 'general',
      target_date: goalData.targetDate || null,
      status: goalData.status || 'pending',
      progress: goalData.progressPercentage || 0,
      priority: goalData.priority || 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // Persist to localStorage
    addDemoGoal(newGoal);
    return { success: true, data: newGoal };
  }

  try {
    const { data, error } = await supabase
      .from('performance_goals')
      .insert([{
        employee_id: toEmployeeId(goalData.employeeId),
        title: goalData.title,
        description: goalData.description || null,
        category: goalData.category || 'general',
        target_date: goalData.targetDate || null,
        status: goalData.status || 'pending',
        progress_percentage: goalData.progressPercentage || 0,
        priority: goalData.priority || 'medium',
        assigned_by: toEmployeeId(goalData.assignedBy),
        assigned_date: goalData.assignedDate || new Date().toISOString().split('T')[0],
        notes: goalData.notes || null,
        success_criteria: goalData.successCriteria || null,
        related_review_id: goalData.relatedReviewId || null
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating performance goal:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all goals
 */
export const getAllPerformanceGoals = async (filters = {}) => {
  if (isDemoMode()) {
    let goals = getDemoGoals();
    
    if (filters.employeeId) {
      goals = goals.filter(g => String(g.employee_id) === String(filters.employeeId));
    }
    if (filters.status) {
      goals = goals.filter(g => g.status === filters.status);
    }
    
    return { success: true, data: goals };
  }

  try {
    let query = supabase
      .from('performance_goals')
      .select(`
        *,
        employee:employees!performance_goals_employee_id_fkey(id, name, position, department),
        assigned_by_employee:employees!performance_goals_assigned_by_fkey(id, name)
      `)
      .order('target_date', { ascending: true });

    if (filters.employeeId) {
      query = query.eq('employee_id', toEmployeeId(filters.employeeId));
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching performance goals:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get goal by ID with milestones
 */
export const getPerformanceGoalById = async (goalId) => {
  if (isDemoMode()) {
    const goal = getDemoGoals().find(g => g.id === goalId);
    return { success: true, data: goal ? { ...goal, milestones: [] } : null };
  }

  try {
    const { data, error } = await supabase
      .from('performance_goals')
      .select(`
        *,
        employee:employees!performance_goals_employee_id_fkey(id, name, position, department),
        assigned_by_employee:employees!performance_goals_assigned_by_fkey(id, name),
        milestones:goal_milestones(*)
      `)
      .eq('id', goalId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching performance goal:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update performance goal
 */
export const updatePerformanceGoal = async (goalId, updates) => {
  if (isDemoMode()) {
    // Map updates to proper field names
    const mappedUpdates = {
      title: updates.title,
      description: updates.description,
      category: updates.category,
      target_date: updates.targetDate,
      status: updates.status,
      progress: updates.progressPercentage !== undefined ? updates.progressPercentage : undefined,
      priority: updates.priority
    };
    // Remove undefined values
    Object.keys(mappedUpdates).forEach(key => mappedUpdates[key] === undefined && delete mappedUpdates[key]);
    
    const updatedGoal = updateDemoGoal(goalId, mappedUpdates);
    if (updatedGoal) {
      return { success: true, data: updatedGoal };
    }
    return { success: false, error: 'Goal not found' };
  }

  try {
    const updateData = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    // Map progressPercentage to the correct database column 'progress'
    if (updates.progressPercentage !== undefined) updateData.progress = updates.progressPercentage;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.successCriteria !== undefined) updateData.success_criteria = updates.successCriteria;
    
    // Set dates based on status
    if (updates.status === 'in_progress' && !updates.startedDate) {
      updateData.started_date = new Date().toISOString().split('T')[0];
    }
    if (updates.status === 'completed' && !updates.completedDate) {
      updateData.completed_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('performance_goals')
      .update(updateData)
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating performance goal:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete performance goal
 */
export const deletePerformanceGoal = async (goalId) => {
  if (isDemoMode()) {
    deleteDemoGoal(goalId);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('performance_goals')
      .delete()
      .eq('id', goalId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting performance goal:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GOAL MILESTONES
// ============================================

/**
 * Create goal milestone
 */
export const createGoalMilestone = async (milestoneData) => {
  if (isDemoMode()) {
    const newMilestone = {
      id: `milestone-demo-${Date.now()}`,
      goal_id: milestoneData.goalId,
      title: milestoneData.title,
      status: milestoneData.status || 'pending',
      created_at: new Date().toISOString()
    };
    return { success: true, data: newMilestone };
  }

  try {
    const { data, error } = await supabase
      .from('goal_milestones')
      .insert([{
        goal_id: milestoneData.goalId,
        title: milestoneData.title,
        description: milestoneData.description || null,
        due_date: milestoneData.dueDate || null,
        status: milestoneData.status || 'pending',
        notes: milestoneData.notes || null,
        sort_order: milestoneData.sortOrder || 0
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating goal milestone:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get milestones for a goal
 */
export const getMilestonesByGoal = async (goalId) => {
  if (isDemoMode()) {
    return { success: true, data: [] };
  }

  try {
    const { data, error } = await supabase
      .from('goal_milestones')
      .select('*')
      .eq('goal_id', goalId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching goal milestones:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update goal milestone
 */
export const updateGoalMilestone = async (milestoneId, updates) => {
  if (isDemoMode()) {
    return { success: true, data: { id: milestoneId, ...updates, updated_at: new Date().toISOString() } };
  }

  try {
    const updateData = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
    
    if (updates.status === 'completed' && !updates.completedDate) {
      updateData.completed_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('goal_milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating goal milestone:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete goal milestone
 */
export const deleteGoalMilestone = async (milestoneId) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('goal_milestones')
      .delete()
      .eq('id', milestoneId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting goal milestone:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SKILLS ASSESSMENTS
// ============================================

/**
 * Create or update skill assessment
 */
export const upsertSkillAssessment = async (skillData) => {
  if (isDemoMode()) {
    const newSkill = upsertDemoSkill({
      employee_id: skillData.employeeId,
      skill_name: skillData.skillName,
      skill_category: skillData.skillCategory || 'technical',
      rating: skillData.rating,
      proficiency_level: skillData.proficiencyLevel || null,
      years_experience: skillData.yearsExperience || null,
      assessed_by: skillData.assessedBy,
      assessment_date: skillData.assessmentDate || new Date().toISOString().split('T')[0],
      notes: skillData.notes || null
    });
    return { success: true, data: newSkill };
  }

  try {
    const { data, error } = await supabase
      .from('skills_assessments')
      .upsert([{
        employee_id: toEmployeeId(skillData.employeeId),
        skill_name: skillData.skillName,
        skill_category: skillData.skillCategory || 'technical',
        rating: skillData.rating,
        proficiency_level: skillData.proficiencyLevel || null,
        years_experience: skillData.yearsExperience || null,
        assessed_by: toEmployeeId(skillData.assessedBy),
        assessment_date: skillData.assessmentDate || new Date().toISOString().split('T')[0],
        notes: skillData.notes || null,
        certification_url: skillData.certificationUrl || null,
        last_used_date: skillData.lastUsedDate || null
      }], {
        onConflict: 'employee_id,skill_name'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error upserting skill assessment:', error);
    return { success: false, error: error.message };
  }
};


export const getSkillsByEmployee = async (employeeId) => {
  if (isDemoMode()) {
    const skills = getDemoSkills().filter(s => String(s.employee_id) === String(employeeId));
    return { success: true, data: skills };
  }

  try {
    const { data, error } = await supabase
      .from('skills_assessments')
      .select('*')
      .eq('employee_id', toEmployeeId(employeeId))
      .order('rating', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee skills:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all skills assessments
 */
export const getAllSkillsAssessments = async (filters = {}) => {
  if (isDemoMode()) {
    let skills = getDemoSkills();
    
    if (filters.employeeId) {
      skills = skills.filter(s => String(s.employee_id) === String(filters.employeeId));
    }
    if (filters.skillCategory) {
      skills = skills.filter(s => s.skill_category === filters.skillCategory);
    }
    
    return { success: true, data: skills };
  }

  try {
    let query = supabase
      .from('skills_assessments')
      .select(`
        *,
        employee:employees!skills_assessments_employee_id_fkey(id, name, position, department)
      `)
      .order('assessment_date', { ascending: false });

    if (filters.employeeId) {
      query = query.eq('employee_id', toEmployeeId(filters.employeeId));
    }
    if (filters.skillCategory) {
      query = query.eq('skill_category', filters.skillCategory);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching skills assessments:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete skill assessment
 */
export const deleteSkillAssessment = async (skillId) => {
  if (isDemoMode()) {
    deleteDemoSkill(skillId);
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('skills_assessments')
      .delete()
      .eq('id', skillId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting skill assessment:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EMPLOYEE FEEDBACK
// ============================================

/**
 * Submit employee feedback
 */
export const submitEmployeeFeedback = async (feedbackData) => {
  if (isDemoMode()) {
    const newFeedback = {
      id: `feedback-demo-${Date.now()}`,
      employee_id: feedbackData.employeeId,
      feedback_from: feedbackData.feedbackFrom,
      feedback_type: feedbackData.feedbackType || 'peer',
      rating: feedbackData.rating || null,
      feedback_text: feedbackData.feedbackText,
      created_at: new Date().toISOString()
    };
    return { success: true, data: newFeedback };
  }

  try {
    const { data, error } = await supabase
      .from('employee_feedback')
      .insert([{
        employee_id: toEmployeeId(feedbackData.employeeId),
        feedback_from: toEmployeeId(feedbackData.feedbackFrom),
        feedback_type: feedbackData.feedbackType || 'peer',
        rating: feedbackData.rating || null,
        feedback_text: feedbackData.feedbackText,
        is_anonymous: feedbackData.isAnonymous || false,
        related_review_id: feedbackData.relatedReviewId || null,
        feedback_date: feedbackData.feedbackDate || new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error submitting employee feedback:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get feedback for an employee
 */
export const getFeedbackByEmployee = async (employeeId) => {
  if (isDemoMode()) {
    const feedback = MOCK_FEEDBACK.filter(f => String(f.employee_id) === String(employeeId));
    return { success: true, data: feedback };
  }

  try {
    const { data, error } = await supabase
      .from('employee_feedback')
      .select(`
        *,
        feedback_from_employee:employees!employee_feedback_feedback_from_fkey(id, name, position)
      `)
      .eq('employee_id', toEmployeeId(employeeId))
      .order('feedback_date', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching employee feedback:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// ANALYTICS AND REPORTS
// ============================================

/**
 * Get employee performance summary
 */
export const getEmployeePerformanceSummary = async (employeeId = null) => {
  if (isDemoMode()) {
    const mockSummary = {
      employee_id: employeeId || 'demo-emp-1',
      average_rating: 4.3,
      total_reviews: 2,
      total_goals: 2,
      completed_goals: 1,
      total_skills: 3
    };
    return { success: true, data: employeeId ? mockSummary : [mockSummary] };
  }

  try {
    let query = supabase
      .from('employee_performance_summary')
      .select('*');

    if (employeeId) {
      query = query.eq('employee_id', toEmployeeId(employeeId));
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: employeeId ? data[0] : data };
  } catch (error) {
    console.error('Error fetching employee performance summary:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get goals with progress
 */
export const getGoalsWithProgress = async (employeeId = null) => {
  if (isDemoMode()) {
    let goals = [...MOCK_GOALS];
    if (employeeId) {
      goals = goals.filter(g => String(g.employee_id) === String(employeeId));
    }
    return { success: true, data: goals };
  }

  try {
    let query = supabase
      .from('goals_with_progress')
      .select('*');

    if (employeeId) {
      query = query.eq('employee_id', toEmployeeId(employeeId));
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching goals with progress:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get skills matrix
 */
export const getSkillsMatrix = async (department = null) => {
  if (isDemoMode()) {
    return { success: true, data: MOCK_SKILLS };
  }

  try {
    let query = supabase
      .from('skills_matrix')
      .select('*');

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching skills matrix:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get performance statistics
 */
export const getPerformanceStats = async () => {
  if (isDemoMode()) {
    return {
      success: true,
      data: {
        totalReviews: MOCK_PERFORMANCE_REVIEWS.length,
        totalGoals: MOCK_GOALS.length,
        completedGoals: MOCK_GOALS.filter(g => g.status === 'completed').length,
        totalSkills: MOCK_SKILLS.length
      }
    };
  }

  try {
    const [reviewsResult, goalsResult, completedGoalsResult, skillsResult] = await Promise.all([
      supabase.from('performance_reviews').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('performance_goals').select('id', { count: 'exact', head: true }),
      supabase.from('performance_goals').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('skills_assessments').select('id', { count: 'exact', head: true })
    ]);

    return {
      success: true,
      data: {
        totalReviews: reviewsResult.count || 0,
        totalGoals: goalsResult.count || 0,
        completedGoals: completedGoalsResult.count || 0,
        totalSkills: skillsResult.count || 0
      }
    };
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Performance Reviews
  createPerformanceReview,
  getAllPerformanceReviews,
  getPerformanceReviewById,
  updatePerformanceReview,
  deletePerformanceReview,
  
  // Performance Goals
  createPerformanceGoal,
  getAllPerformanceGoals,
  getPerformanceGoalById,
  updatePerformanceGoal,
  deletePerformanceGoal,
  
  // Goal Milestones
  createGoalMilestone,
  getMilestonesByGoal,
  updateGoalMilestone,
  deleteGoalMilestone,
  
  // Skills Assessments
  upsertSkillAssessment,
  getSkillsByEmployee,
  getAllSkillsAssessments,
  deleteSkillAssessment,
  
  // Employee Feedback
  submitEmployeeFeedback,
  getFeedbackByEmployee,
  
  // Analytics
  getEmployeePerformanceSummary,
  getGoalsWithProgress,
  getSkillsMatrix,
  getPerformanceStats
};
