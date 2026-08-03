import { supabase } from '../config/supabaseClient';
import { 
  isDemoMode, 
  MOCK_JOB_POSTINGS, 
  MOCK_APPLICANTS, 
  MOCK_APPLICATIONS, 
  MOCK_INTERVIEWS 
} from '../utils/demoHelper';

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
  if (isDemoMode()) {
    let data = [...MOCK_JOB_POSTINGS];
    if (filters.status) {
      data = data.filter(job => job.status === filters.status);
    }
    if (filters.department) {
      data = data.filter(job => job.department === filters.department);
    }
    return { success: true, data };
  }

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
 * The form speaks in the names the UI uses; `job_postings` (migration 005) stores
 * some of them under different names. Keep the translation here so the form does
 * not have to know the table.
 */
const JOB_POSTING_ALIASES = {
  employment_type: 'position_type',
};

/** PostgREST's "column not found in schema cache" code. */
const PGRST_UNKNOWN_COLUMN = 'PGRST204';

/** Pull the offending column out of `Could not find the 'x' column of 'y' ...`. */
const unknownColumnFrom = (error) => {
  if (error?.code !== PGRST_UNKNOWN_COLUMN) return null;
  return /'([^']+)' column/.exec(error.message || '')?.[1] || null;
};

/**
 * Shape a posting for the table: apply the aliases, fold a min/max pair into the
 * single `salary_range` string the table actually has, and drop empty values so
 * we never send a column just to write '' into it.
 */
const normalizeJobPosting = (jobData) => {
  const { salary_min: min, salary_max: max, ...rest } = jobData;

  const out = {};
  Object.entries(rest).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    out[JOB_POSTING_ALIASES[key] || key] = value;
  });

  if (min != null && max != null) out.salary_range = `${min} - ${max}`;
  else if (min != null) out.salary_range = `${min}+`;
  else if (max != null) out.salary_range = `up to ${max}`;

  return out;
};

/**
 * Create job posting.
 *
 * Deployments of this schema have drifted, so an insert can fail on a column the
 * local table simply does not have. Rather than lose the whole posting, drop the
 * rejected column and retry, then report what was left out — the caller surfaces
 * it so the omission is visible instead of silent.
 */
export const createJobPosting = async (jobData) => {
  let payload = normalizeJobPosting(jobData);
  const droppedColumns = [];

  try {
    // Bounded by the field count: every retry removes exactly one column.
    for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
      const { data, error } = await supabase
        .from('job_postings')
        .insert([payload])
        .select()
        .single();

      if (!error) return { success: true, data, droppedColumns };

      const unknown = unknownColumnFrom(error);
      if (!unknown || !(unknown in payload)) throw error;

      console.warn(`job_postings has no '${unknown}' column — retrying without it`);
      droppedColumns.push(unknown);
      const { [unknown]: _removed, ...remaining } = payload;
      payload = remaining;
    }
    throw new Error('Could not match the job posting to the job_postings table');
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
  if (isDemoMode()) {
    return { success: true, data: MOCK_APPLICANTS };
  }

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
  if (isDemoMode()) {
    let data = [...MOCK_APPLICATIONS];
    if (filters.status) {
      data = data.filter(app => app.status === filters.status);
    }
    if (filters.jobPostingId) {
      data = data.filter(app => app.job_posting_id === filters.jobPostingId);
    }
    return { success: true, data };
  }

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
  if (isDemoMode()) {
    const application = MOCK_APPLICATIONS.find(a => a.id === applicationId);
    if (application) {
      return { success: true, data: application };
    }
    return { success: false, error: 'Application not found' };
  }

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
  if (isDemoMode()) {
    const interviews = MOCK_INTERVIEWS.filter(i => i.application_id === applicationId);
    return { success: true, data: interviews };
  }

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
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const interviews = MOCK_INTERVIEWS.filter(i => i.scheduled_date >= now && i.status === 'scheduled');
    return { success: true, data: interviews };
  }

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
  if (isDemoMode()) {
    // Return mock metrics
    const metrics = {
      views: 150,
      applications: 12,
      interviews: 4,
      offers: 1,
      hires: 0,
      time_to_hire: 15,
      source_breakdown: { linkedin: 40, website: 30, referral: 30 }
    };
    return { success: true, data: metrics };
  }

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
  if (isDemoMode()) {
    const stats = {
      total: MOCK_APPLICATIONS.length,
      underReview: MOCK_APPLICATIONS.filter(a => a.status === 'under review').length,
      shortlisted: MOCK_APPLICATIONS.filter(a => a.status === 'shortlisted').length,
      interviewScheduled: MOCK_APPLICATIONS.filter(a => a.status === 'interview scheduled').length,
      offerExtended: MOCK_APPLICATIONS.filter(a => a.status === 'offer extended').length,
      hired: MOCK_APPLICATIONS.filter(a => a.status === 'hired').length,
      rejected: MOCK_APPLICATIONS.filter(a => a.status === 'rejected').length
    };
    return { success: true, data: stats };
  }

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

    const { error } = await supabase.storage
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
