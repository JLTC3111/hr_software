import { supabase } from '../config/supabaseClient';

/**
 * Recruitment Service
 * Handles all Supabase operations for job postings, applications, and interviews
 */

// ============================================
// JOB POSTINGS
// ============================================

/**
 * Create a new job posting
 */
export const createJobPosting = async (jobData) => {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .insert([{
        title: jobData.title,
        department: jobData.department,
        position_type: jobData.positionType || 'full-time',
        description: jobData.description || null,
        requirements: jobData.requirements || null,
        responsibilities: jobData.responsibilities || null,
        salary_range: jobData.salaryRange || null,
        location: jobData.location || 'Office',
        posted_by: jobData.postedBy || null,
        status: jobData.status || 'active',
        posted_date: jobData.postedDate || new Date().toISOString().split('T')[0],
        closing_date: jobData.closingDate || null,
        openings: jobData.openings || 1
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating job posting:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all job postings
 */
export const getAllJobPostings = async (filters = {}) => {
  try {
    let query = supabase
      .from('job_postings')
      .select('*')
      .order('posted_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.department) {
      query = query.eq('department', filters.department);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching job postings:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get job posting by ID
 */
export const getJobPostingById = async (jobId) => {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching job posting:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update job posting
 */
export const updateJobPosting = async (jobId, updates) => {
  try {
    const updateData = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.positionType !== undefined) updateData.position_type = updates.positionType;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.requirements !== undefined) updateData.requirements = updates.requirements;
    if (updates.responsibilities !== undefined) updateData.responsibilities = updates.responsibilities;
    if (updates.salaryRange !== undefined) updateData.salary_range = updates.salaryRange;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.closingDate !== undefined) updateData.closing_date = updates.closingDate;
    if (updates.openings !== undefined) updateData.openings = updates.openings;

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating job posting:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete job posting
 */
export const deleteJobPosting = async (jobId) => {
  try {
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting job posting:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// JOB APPLICATIONS
// ============================================

/**
 * Create a new job application
 */
export const createJobApplication = async (applicationData) => {
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .insert([{
        job_posting_id: applicationData.jobPostingId,
        candidate_name: applicationData.candidateName,
        email: applicationData.email,
        phone: applicationData.phone || null,
        resume_url: applicationData.resumeUrl || null,
        cover_letter: applicationData.coverLetter || null,
        portfolio_url: applicationData.portfolioUrl || null,
        linkedin_url: applicationData.linkedinUrl || null,
        experience_years: applicationData.experienceYears || 0,
        current_company: applicationData.currentCompany || null,
        current_position: applicationData.currentPosition || null,
        expected_salary: applicationData.expectedSalary || null,
        notice_period: applicationData.noticePeriod || null,
        status: applicationData.status || 'applied',
        stage: applicationData.stage || 'screening',
        applied_date: applicationData.appliedDate || new Date().toISOString().split('T')[0],
        notes: applicationData.notes || null,
        rating: applicationData.rating || null
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating job application:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all job applications
 */
export const getAllApplications = async (filters = {}) => {
  try {
    let query = supabase
      .from('job_applications')
      .select(`
        *,
        job_posting:job_postings(*)
      `)
      .order('applied_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.stage) {
      query = query.eq('stage', filters.stage);
    }
    if (filters.jobPostingId) {
      query = query.eq('job_posting_id', filters.jobPostingId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching applications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get application by ID
 */
export const getApplicationById = async (applicationId) => {
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        job_posting:job_postings(*)
      `)
      .eq('id', applicationId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching application:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update job application
 */
export const updateJobApplication = async (applicationId, updates) => {
  try {
    const updateData = {};
    
    if (updates.candidateName !== undefined) updateData.candidate_name = updates.candidateName;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.resumeUrl !== undefined) updateData.resume_url = updates.resumeUrl;
    if (updates.coverLetter !== undefined) updateData.cover_letter = updates.coverLetter;
    if (updates.portfolioUrl !== undefined) updateData.portfolio_url = updates.portfolioUrl;
    if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl;
    if (updates.experienceYears !== undefined) updateData.experience_years = updates.experienceYears;
    if (updates.currentCompany !== undefined) updateData.current_company = updates.currentCompany;
    if (updates.currentPosition !== undefined) updateData.current_position = updates.currentPosition;
    if (updates.expectedSalary !== undefined) updateData.expected_salary = updates.expectedSalary;
    if (updates.noticePeriod !== undefined) updateData.notice_period = updates.noticePeriod;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.stage !== undefined) updateData.stage = updates.stage;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.rating !== undefined) updateData.rating = updates.rating;

    const { data, error } = await supabase
      .from('job_applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating application:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update application status
 */
export const updateApplicationStatus = async (applicationId, status, stage = null) => {
  try {
    const updateData = { status };
    if (stage) updateData.stage = stage;

    const { data, error } = await supabase
      .from('job_applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating application status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete job application
 */
export const deleteJobApplication = async (applicationId) => {
  try {
    const { error } = await supabase
      .from('job_applications')
      .delete()
      .eq('id', applicationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting application:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// INTERVIEW SCHEDULES
// ============================================

/**
 * Create interview schedule
 */
export const createInterviewSchedule = async (interviewData) => {
  try {
    const { data, error } = await supabase
      .from('interview_schedules')
      .insert([{
        application_id: interviewData.applicationId,
        interviewer_id: interviewData.interviewerId || null,
        interview_type: interviewData.interviewType,
        scheduled_time: interviewData.scheduledTime,
        duration_minutes: interviewData.durationMinutes || 60,
        location: interviewData.location || null,
        meeting_link: interviewData.meetingLink || null,
        notes: interviewData.notes || null,
        status: interviewData.status || 'scheduled'
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating interview schedule:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get interviews for an application
 */
export const getInterviewsByApplication = async (applicationId) => {
  try {
    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        *,
        interviewer:employees(id, name, email, position)
      `)
      .eq('application_id', applicationId)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching interviews:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all upcoming interviews
 */
export const getUpcomingInterviews = async () => {
  try {
    const { data, error } = await supabase
      .from('upcoming_interviews')
      .select('*')
      .order('scheduled_time', { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching upcoming interviews:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update interview schedule
 */
export const updateInterviewSchedule = async (interviewId, updates) => {
  try {
    const updateData = {};
    
    if (updates.interviewerId !== undefined) updateData.interviewer_id = updates.interviewerId;
    if (updates.interviewType !== undefined) updateData.interview_type = updates.interviewType;
    if (updates.scheduledTime !== undefined) updateData.scheduled_time = updates.scheduledTime;
    if (updates.durationMinutes !== undefined) updateData.duration_minutes = updates.durationMinutes;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.meetingLink !== undefined) updateData.meeting_link = updates.meetingLink;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.feedback !== undefined) updateData.feedback = updates.feedback;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.recommendation !== undefined) updateData.recommendation = updates.recommendation;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;

    const { data, error } = await supabase
      .from('interview_schedules')
      .update(updateData)
      .eq('id', interviewId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating interview schedule:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Submit interview feedback
 */
export const submitInterviewFeedback = async (interviewId, feedback, rating, recommendation) => {
  try {
    const { data, error } = await supabase
      .from('interview_schedules')
      .update({
        feedback,
        rating,
        recommendation,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', interviewId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error submitting interview feedback:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete interview schedule
 */
export const deleteInterviewSchedule = async (interviewId) => {
  try {
    const { error } = await supabase
      .from('interview_schedules')
      .delete()
      .eq('id', interviewId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting interview schedule:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// FILE UPLOADS
// ============================================

/**
 * Upload resume file
 */
export const uploadResume = async (file, candidateName) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${candidateName.replace(/\s+/g, '_')}_${Date.now()}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(filePath, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('hr-documents')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrl,
      fileName: file.name,
      fileType: file.type
    };
  } catch (error) {
    console.error('Error uploading resume:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// ANALYTICS AND REPORTS
// ============================================

/**
 * Get recruitment pipeline statistics
 */
export const getRecruitmentPipeline = async () => {
  try {
    const { data, error } = await supabase
      .from('recruitment_pipeline')
      .select('*');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching recruitment pipeline:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get application statistics
 */
export const getApplicationStats = async () => {
  try {
    const [totalResult, appliedResult, screeningResult, interviewResult, offerResult, hiredResult, rejectedResult] = await Promise.all([
      supabase.from('job_applications').select('id', { count: 'exact', head: true }),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'applied'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'screening'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'interview_scheduled'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'offer'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'hired'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected')
    ]);

    return {
      success: true,
      data: {
        total: totalResult.count || 0,
        applied: appliedResult.count || 0,
        screening: screeningResult.count || 0,
        interview: interviewResult.count || 0,
        offer: offerResult.count || 0,
        hired: hiredResult.count || 0,
        rejected: rejectedResult.count || 0
      }
    };
  } catch (error) {
    console.error('Error fetching application stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Search applications
 */
export const searchApplications = async (searchTerm) => {
  try {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        job_posting:job_postings(*)
      `)
      .or(`candidate_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('applied_date', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching applications:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Job Postings
  createJobPosting,
  getAllJobPostings,
  getJobPostingById,
  updateJobPosting,
  deleteJobPosting,
  
  // Applications
  createJobApplication,
  getAllApplications,
  getApplicationById,
  updateJobApplication,
  updateApplicationStatus,
  deleteJobApplication,
  searchApplications,
  
  // Interviews
  createInterviewSchedule,
  getInterviewsByApplication,
  getUpcomingInterviews,
  updateInterviewSchedule,
  submitInterviewFeedback,
  deleteInterviewSchedule,
  
  // File Uploads
  uploadResume,
  
  // Analytics
  getRecruitmentPipeline,
  getApplicationStats
};
