import { supabase } from '../config/supabaseClient';

/**
 * Recruitment Service
 * Handles all Supabase operations for recruitment system
 * Updated to use new schema: job_postings, applicants, applications, interview_schedules, recruitment_metrics
 */

// ====================================
// JOB POSTINGS
// ====================================

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
 * Create job posting
 */
export const createJobPosting = async (jobData) => {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .insert([jobData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating job posting:', error);
    return { success: false, error: error.message };
  }
};

// ====================================
// APPLICANTS
// ====================================

/**
 * Get all applicants
 */
export const getAllApplicants = async () => {
  try {
    const { data, error } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching applicants:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create applicant
 */
export const createApplicant = async (applicantData) => {
  try {
    const { data, error } = await supabase
      .from('applicants')
      .insert([applicantData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating applicant:', error);
    return { success: false, error: error.message };
  }
};

// ====================================
// APPLICATIONS (Main Table)
// ====================================

/**
 * Get all applications with job and applicant details
 */
export const getAllApplications = async (filters = {}) => {
  try {
    let query = supabase
      .from('applications')
      .select(`
        *,
        job_posting:job_postings(*),
        applicant:applicants(*),
        reviewer:employees!applications_reviewed_by_fkey(id, name)
      `)
      .order('application_date', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
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
      .from('applications')
      .select(`
        *,
        job_posting:job_postings(*),
        applicant:applicants(*),
        reviewer:employees!applications_reviewed_by_fkey(id, name)
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
 * Update application status
 */
export const updateApplicationStatus = async (applicationId, status, reviewerId = null) => {
  try {
    const updateData = {
      status,
      reviewed_date: new Date().toISOString()
    };
    
    if (reviewerId) {
      updateData.reviewed_by = reviewerId;
    }

    const { data, error } = await supabase
      .from('applications')
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
 * Update application rating
 */
export const updateApplicationRating = async (applicationId, rating, notes = null) => {
  try {
    const updateData = { rating };
    if (notes) updateData.notes = notes;

    const { data, error } = await supabase
      .from('applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating application rating:', error);
    return { success: false, error: error.message };
  }
};

// ====================================
// INTERVIEW SCHEDULES
// ====================================

/**
 * Create interview schedule
 */
export const createInterviewSchedule = async (interviewData) => {
  try {
    const { data, error } = await supabase
      .from('interview_schedules')
      .insert([interviewData])
      .select()
      .single();

    if (error) throw error;
    
    // Update application status to "interview scheduled"
    if (interviewData.application_id) {
      await updateApplicationStatus(interviewData.application_id, 'interview scheduled');
    }

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
        application:applications(
          *,
          applicant:applicants(*),
          job_posting:job_postings(*)
        )
      `)
      .eq('application_id', applicationId)
      .order('scheduled_date', { ascending: true });

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
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('interview_schedules')
      .select(`
        *,
        application:applications(
          *,
          applicant:applicants(*),
          job_posting:job_postings(*)
        )
      `)
      .gte('scheduled_date', now)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true });

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
    const { data, error } = await supabase
      .from('interview_schedules')
      .update(updates)
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

// ====================================
// RECRUITMENT METRICS
// ====================================

/**
 * Get recruitment metrics for a job posting
 */
export const getRecruitmentMetrics = async (jobPostingId = null) => {
  try {
    let query = supabase
      .from('recruitment_metrics')
      .select(`
        *,
        job_posting:job_postings(title, department, position)
      `);

    if (jobPostingId) {
      query = query.eq('job_posting_id', jobPostingId).single();
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching recruitment metrics:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get overall recruitment statistics
 */
export const getRecruitmentStats = async () => {
  try {
    // Get counts for each status
    const { data: applications, error } = await supabase
      .from('applications')
      .select('status');

    if (error) throw error;

    const stats = {
      total: applications.length,
      underReview: applications.filter(a => a.status === 'under review').length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      interviewScheduled: applications.filter(a => a.status === 'interview scheduled').length,
      offerExtended: applications.filter(a => a.status === 'offer extended').length,
      hired: applications.filter(a => a.status === 'hired').length,
      rejected: applications.filter(a => a.status === 'rejected').length
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching recruitment stats:', error);
    return { success: false, error: error.message };
  }
};

// ====================================
// FILE UPLOADS
// ====================================

/**
 * Upload resume file to storage
 */
export const uploadResume = async (file, applicantId) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${applicantId}_${Date.now()}.${fileExt}`;
    const filePath = `resumes/${fileName}`;

    const { data, error } = await supabase.storage
      .from('employee-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('Error uploading resume:', error);
    return { success: false, error: error.message };
  }
};

// ====================================
// EXPORTS
// ====================================

export default {
  // Job Postings
  getAllJobPostings,
  createJobPosting,
  
  // Applicants
  getAllApplicants,
  createApplicant,
  
  // Applications
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  updateApplicationRating,
  
  // Interviews
  createInterviewSchedule,
  getInterviewsByApplication,
  getUpcomingInterviews,
  updateInterviewSchedule,
  
  // Metrics
  getRecruitmentMetrics,
  getRecruitmentStats,
  
  // File Uploads
  uploadResume
};
