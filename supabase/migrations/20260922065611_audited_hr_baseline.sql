-- HR-only schema baseline captured from PostgreSQL catalogs on 2026-09-22.

-- Replaces the incomplete legacy migration chain (preserved in ../legacy_migrations).

-- Fresh databases only: see ../README.md before upgrading an existing project.

-- No employee/candidate data or objects owned by other applications are included.

SET check_function_bodies = off;

CREATE SCHEMA IF NOT EXISTS private;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

SET search_path = public, extensions;

GRANT USAGE ON SCHEMA public, private TO authenticated, service_role;

CREATE SEQUENCE public."employees_id_seq";

CREATE SEQUENCE public."interview_schedules_id_seq";

CREATE SEQUENCE public."job_applications_id_seq";

CREATE SEQUENCE public."job_postings_id_seq";

CREATE SEQUENCE public."leave_requests_id_seq";

CREATE SEQUENCE public."overtime_logs_id_seq";

CREATE SEQUENCE public."proof_file_audit_id_seq";

CREATE SEQUENCE public."skills_assessments_id_seq";

CREATE SEQUENCE public."time_entries_id_seq";

CREATE SEQUENCE public."time_tracking_summary_id_seq";

CREATE SEQUENCE public."user_emails_id_seq";

CREATE SEQUENCE public."workload_tasks_id_seq";

CREATE TABLE public."hr_users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" character varying(255) NOT NULL,
  "first_name" character varying(100),
  "last_name" character varying(100),
  "full_name" character varying(255) GENERATED ALWAYS AS (
CASE
    WHEN ((first_name IS NOT NULL) AND (last_name IS NOT NULL)) THEN ((((first_name)::text || ' '::text) || (last_name)::text))::character varying
    WHEN (first_name IS NOT NULL) THEN first_name
    WHEN (last_name IS NOT NULL) THEN last_name
    ELSE email
END) STORED,
  "phone" character varying(50),
  "avatar_url" text,
  "employee_id" text,
  "department" character varying(100),
  "position" character varying(100),
  "manager_id" uuid,
  "hire_date" date,
  "employment_status" character varying(50) DEFAULT 'active'::character varying,
  "salary" numeric(12,2),
  "role" character varying(50) DEFAULT 'employee'::character varying NOT NULL,
  "is_active" boolean DEFAULT true,
  "email_verified" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "last_login" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "primary_email" character varying(255)
);

CREATE TABLE public."user_emails" (
  "id" integer DEFAULT nextval('user_emails_id_seq'::regclass) NOT NULL,
  "hr_user_id" uuid NOT NULL,
  "auth_user_id" uuid NOT NULL,
  "email" character varying(255) NOT NULL,
  "is_primary" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."employees" (
  "id" text DEFAULT nextval('employees_id_seq'::regclass) NOT NULL,
  "name" character varying(255) NOT NULL,
  "position" character varying(100),
  "department" character varying(100),
  "email" character varying(255) NOT NULL,
  "dob" date,
  "address" text,
  "phone" character varying(50),
  "start_date" date,
  "status" character varying(50) DEFAULT 'Active'::character varying,
  "performance" numeric(3,2),
  "photo" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "user_id" uuid,
  "pdf_document_url" text
);

CREATE TABLE public."hr_user_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email_notifications" boolean DEFAULT true,
  "push_notifications" boolean DEFAULT true,
  "desktop_notifications" boolean DEFAULT false,
  "notification_frequency" character varying(20) DEFAULT 'realtime'::character varying,
  "notify_time_tracking" boolean DEFAULT true,
  "notify_performance" boolean DEFAULT true,
  "notify_employee_updates" boolean DEFAULT true,
  "notify_recruitment" boolean DEFAULT true,
  "notify_system" boolean DEFAULT true,
  "theme" character varying(20) DEFAULT 'system'::character varying,
  "language" character varying(10) DEFAULT 'en'::character varying,
  "timezone" character varying(50) DEFAULT 'UTC'::character varying,
  "date_format" character varying(20) DEFAULT 'MM/DD/YYYY'::character varying,
  "time_format" character varying(10) DEFAULT '12h'::character varying,
  "profile_visibility" character varying(20) DEFAULT 'all'::character varying,
  "show_email" boolean DEFAULT true,
  "show_phone" boolean DEFAULT true,
  "default_dashboard_view" character varying(50) DEFAULT 'overview'::character varying,
  "items_per_page" integer DEFAULT 10,
  "auto_clock_out" boolean DEFAULT false,
  "auto_clock_out_time" time without time zone DEFAULT '18:00:00'::time without time zone,
  "weekly_report" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "notification_sound" boolean DEFAULT false
);

CREATE TABLE public."hr_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" character varying(255) NOT NULL,
  "message" text NOT NULL,
  "type" character varying(50) DEFAULT 'info'::character varying NOT NULL,
  "category" character varying(50) DEFAULT 'general'::character varying,
  "is_read" boolean DEFAULT false,
  "action_url" character varying(500),
  "action_label" character varying(100),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "read_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);

CREATE TABLE public."hr_user_permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "permission" text NOT NULL,
  "granted_by" uuid,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."applicants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "full_name" character varying(255) NOT NULL,
  "email" character varying(255) NOT NULL,
  "phone" character varying(50),
  "address" text,
  "date_of_birth" date,
  "linkedin_profile" character varying(500),
  "portfolio_url" character varying(500),
  "years_of_experience" integer DEFAULT 0,
  "current_company" character varying(255),
  "current_position" character varying(255),
  "education_level" character varying(100),
  "resume_url" text,
  "cover_letter" text,
  "skills" text[],
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_posting_id" bigint,
  "applicant_id" uuid,
  "status" character varying(50) DEFAULT 'under review'::character varying,
  "application_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" text,
  "reviewed_date" timestamp without time zone,
  "notes" text,
  "rating" integer,
  "rejection_reason" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."job_postings" (
  "id" bigint DEFAULT nextval('job_postings_id_seq'::regclass) NOT NULL,
  "title" character varying(255) NOT NULL,
  "department" character varying(100) NOT NULL,
  "position_type" character varying(50) DEFAULT 'full-time'::character varying NOT NULL,
  "description" text,
  "requirements" text,
  "responsibilities" text,
  "salary_range" character varying(100),
  "location" character varying(255) DEFAULT 'Office'::character varying,
  "posted_by" text,
  "status" character varying(50) DEFAULT 'active'::character varying,
  "posted_date" date DEFAULT CURRENT_DATE,
  "closing_date" date,
  "openings" integer DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."job_applications" (
  "id" bigint DEFAULT nextval('job_applications_id_seq'::regclass) NOT NULL,
  "job_posting_id" bigint,
  "candidate_name" character varying(255) NOT NULL,
  "email" character varying(255) NOT NULL,
  "phone" character varying(50),
  "resume_url" text,
  "cover_letter" text,
  "portfolio_url" text,
  "linkedin_url" text,
  "experience_years" integer DEFAULT 0,
  "current_company" character varying(255),
  "current_position" character varying(255),
  "expected_salary" character varying(100),
  "notice_period" character varying(50),
  "status" character varying(50) DEFAULT 'applied'::character varying,
  "stage" character varying(50) DEFAULT 'screening'::character varying,
  "applied_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "rating" numeric(3,2),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."interview_schedules" (
  "id" bigint DEFAULT nextval('interview_schedules_id_seq'::regclass) NOT NULL,
  "application_id" bigint NOT NULL,
  "interviewer_id" text,
  "interview_type" character varying(50) NOT NULL,
  "scheduled_time" timestamp with time zone NOT NULL,
  "duration_minutes" integer DEFAULT 60,
  "location" character varying(255),
  "meeting_link" text,
  "notes" text,
  "status" character varying(50) DEFAULT 'scheduled'::character varying,
  "feedback" text,
  "rating" numeric(3,2),
  "recommendation" character varying(50),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."recruitment_metrics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_posting_id" bigint,
  "total_applications" integer DEFAULT 0,
  "under_review" integer DEFAULT 0,
  "shortlisted" integer DEFAULT 0,
  "interviews_scheduled" integer DEFAULT 0,
  "offers_extended" integer DEFAULT 0,
  "hired" integer DEFAULT 0,
  "rejected" integer DEFAULT 0,
  "avg_time_to_hire_days" numeric(5,2),
  "last_updated" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."performance_reviews" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "employee_id" text NOT NULL,
  "reviewer_id" text,
  "review_period" text,
  "review_type" text DEFAULT 'quarterly'::text NOT NULL,
  "overall_rating" numeric(2,1),
  "technical_skills_rating" numeric(2,1),
  "communication_rating" numeric(2,1),
  "leadership_rating" numeric(2,1),
  "teamwork_rating" numeric(2,1),
  "problem_solving_rating" numeric(2,1),
  "strengths" text,
  "areas_for_improvement" text,
  "achievements" text,
  "comments" text,
  "employee_comments" text,
  "goals_met" integer DEFAULT 0,
  "goals_total" integer DEFAULT 0,
  "status" text DEFAULT 'draft'::text,
  "review_date" date DEFAULT CURRENT_DATE,
  "due_date" date,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "self_assessment_skipped" boolean DEFAULT false NOT NULL
);

CREATE TABLE public."performance_goals" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "employee_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'general'::text,
  "target_date" date,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "progress_percentage" integer DEFAULT 0,
  "priority" text DEFAULT 'medium'::text,
  "assigned_by" text,
  "assigned_date" date DEFAULT CURRENT_DATE,
  "started_date" date,
  "completed_date" date,
  "notes" text,
  "success_criteria" text,
  "related_review_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "progress" integer DEFAULT 0
);

CREATE TABLE public."goal_milestones" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "goal_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" date,
  "status" text DEFAULT 'pending'::text,
  "completed_date" date,
  "notes" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."goal_check_ins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL,
  "employee_id" text NOT NULL,
  "author_auth_id" uuid NOT NULL,
  "progress_percentage" integer,
  "note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."skills_assessments" (
  "id" bigint DEFAULT nextval('skills_assessments_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "skill_name" character varying(255) NOT NULL,
  "skill_category" character varying(50) DEFAULT 'technical'::character varying,
  "rating" numeric(3,2) NOT NULL,
  "proficiency_level" character varying(50),
  "years_experience" numeric(4,1),
  "assessed_by" text,
  "assessment_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "certification_url" text,
  "last_used_date" date,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."performance_skills" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "employee_id" text NOT NULL,
  "skill_name" text NOT NULL,
  "skill_category" text DEFAULT 'technical'::text,
  "rating" numeric(2,1),
  "proficiency_level" text,
  "years_experience" integer,
  "assessed_by" text,
  "assessment_date" date DEFAULT CURRENT_DATE,
  "notes" text,
  "certification_url" text,
  "last_used_date" date,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."performance_comments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "goal_id" uuid,
  "author" text NOT NULL,
  "author_id" text,
  "comment" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."employee_feedback" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "employee_id" text NOT NULL,
  "feedback_from" text,
  "feedback_type" text DEFAULT 'peer'::text,
  "rating" numeric(2,1),
  "feedback_text" text NOT NULL,
  "is_anonymous" boolean DEFAULT false,
  "related_review_id" uuid,
  "feedback_date" date DEFAULT CURRENT_DATE,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."time_entries" (
  "id" bigint DEFAULT nextval('time_entries_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "date" date NOT NULL,
  "clock_in" time without time zone NOT NULL,
  "clock_out" time without time zone NOT NULL,
  "hours" numeric(4,1) NOT NULL,
  "hour_type" character varying(50) DEFAULT 'regular'::character varying NOT NULL,
  "notes" text,
  "proof_file_url" text,
  "proof_file_name" text,
  "proof_file_type" character varying(50),
  "status" character varying(50) DEFAULT 'pending'::character varying,
  "submitted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "proof_file_path" text
);

CREATE TABLE public."leave_requests" (
  "id" bigint DEFAULT nextval('leave_requests_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "leave_type" character varying(50) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "days_count" numeric(3,1) NOT NULL,
  "reason" text,
  "status" character varying(50) DEFAULT 'pending'::character varying,
  "submitted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "proof_file_url" text,
  "proof_file_name" text,
  "proof_file_type" character varying(50),
  "proof_file_path" text
);

CREATE TABLE public."overtime_logs" (
  "id" bigint DEFAULT nextval('overtime_logs_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "date" date NOT NULL,
  "hours" numeric(4,1) NOT NULL,
  "reason" text NOT NULL,
  "overtime_type" character varying(50) DEFAULT 'regular'::character varying,
  "status" character varying(50) DEFAULT 'pending'::character varying,
  "submitted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."time_tracking_summary" (
  "id" bigint DEFAULT nextval('time_tracking_summary_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "days_worked" integer DEFAULT 0,
  "leave_days" numeric(4,1) DEFAULT 0,
  "regular_hours" numeric(6,1) DEFAULT 0,
  "overtime_hours" numeric(6,1) DEFAULT 0,
  "holiday_overtime_hours" numeric(6,1) DEFAULT 0,
  "total_hours" numeric(6,1) DEFAULT 0,
  "attendance_rate" numeric(5,2) DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."open_punches" (
  "employee_id" text NOT NULL,
  "date" date NOT NULL,
  "clock_in" time without time zone NOT NULL,
  "breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE public."workload_tasks" (
  "id" bigint DEFAULT nextval('workload_tasks_id_seq'::regclass) NOT NULL,
  "employee_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" date,
  "priority" text DEFAULT 'medium'::text,
  "status" text DEFAULT 'pending'::text,
  "self_assessment" text,
  "quality_rating" integer DEFAULT 0,
  "comments" text,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "start_date" date,
  "completion_date" date
);

CREATE TABLE public."hr_ugc_translations" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "field" text NOT NULL,
  "locale" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "source_text" text DEFAULT ''::text NOT NULL,
  "source_hash" text DEFAULT ''::text NOT NULL,
  "provider" text DEFAULT 'manual'::text NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."visits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ip" text,
  "user_agent" text,
  "path" text,
  "referrer" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid,
  "role" text,
  "is_demo" boolean DEFAULT false,
  "ip_region" text,
  "is_proxy" boolean DEFAULT false,
  "is_vpn" boolean DEFAULT false,
  "is_hosting" boolean DEFAULT false,
  "connection_type" text DEFAULT 'unknown'::text
);

CREATE TABLE public."translation_cache" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "source_hash" text NOT NULL,
  "target_lang" text NOT NULL,
  "source_text" text NOT NULL,
  "translated_text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."proof_file_audit" (
  "id" bigint DEFAULT nextval('proof_file_audit_id_seq'::regclass) NOT NULL,
  "operation" character varying(20) NOT NULL,
  "entity_type" character varying(50) NOT NULL,
  "entity_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "file_name" text,
  "file_type" character varying(50),
  "file_size" integer,
  "storage_path" text,
  "performed_by" text,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE public."applications" ADD CONSTRAINT "applications_rating_check" CHECK (((rating >= 1) AND (rating <= 5)));

ALTER TABLE public."employee_feedback" ADD CONSTRAINT "employee_feedback_rating_check" CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)));

ALTER TABLE public."employee_feedback" ADD CONSTRAINT "valid_feedback_type" CHECK ((feedback_type = ANY (ARRAY['peer'::text, 'manager'::text, 'self'::text, '360'::text])));

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_note_check" CHECK (((char_length(btrim(note)) >= 1) AND (char_length(btrim(note)) <= 4000)));

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_progress_percentage_check" CHECK (((progress_percentage >= 0) AND (progress_percentage <= 100)));

ALTER TABLE public."goal_milestones" ADD CONSTRAINT "valid_milestone_status" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));

ALTER TABLE public."hr_ugc_translations" ADD CONSTRAINT "hr_ugc_translations_entity_type_check" CHECK ((entity_type = ANY (ARRAY['task'::text, 'goal'::text, 'review'::text, 'leave'::text])));

ALTER TABLE public."hr_ugc_translations" ADD CONSTRAINT "hr_ugc_translations_provider_check" CHECK ((provider = ANY (ARRAY['manual'::text, 'machine'::text])));

ALTER TABLE public."hr_user_permissions" ADD CONSTRAINT "hr_user_permissions_permission_check" CHECK ((permission = 'reminder_support_access'::text));

ALTER TABLE public."hr_users" ADD CONSTRAINT "valid_employment_status" CHECK (((employment_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'terminated'::character varying, 'on_leave'::character varying, 'probation'::character varying])::text[])));

ALTER TABLE public."hr_users" ADD CONSTRAINT "valid_role" CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'employee'::character varying, 'hr_manager'::character varying])::text[])));

ALTER TABLE public."performance_goals" ADD CONSTRAINT "performance_goals_progress_check" CHECK (((progress >= 0) AND (progress <= 100)));

ALTER TABLE public."performance_goals" ADD CONSTRAINT "performance_goals_progress_percentage_check" CHECK (((progress_percentage >= 0) AND (progress_percentage <= 100)));

ALTER TABLE public."performance_goals" ADD CONSTRAINT "valid_priority" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));

ALTER TABLE public."performance_goals" ADD CONSTRAINT "valid_status" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'on_hold'::text])));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_communication_rating_check" CHECK (((communication_rating >= (0)::numeric) AND (communication_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_leadership_rating_check" CHECK (((leadership_rating >= (0)::numeric) AND (leadership_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_overall_rating_check" CHECK (((overall_rating >= (0)::numeric) AND (overall_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_problem_solving_rating_check" CHECK (((problem_solving_rating >= (0)::numeric) AND (problem_solving_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_teamwork_rating_check" CHECK (((teamwork_rating >= (0)::numeric) AND (teamwork_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_technical_skills_rating_check" CHECK (((technical_skills_rating >= (0)::numeric) AND (technical_skills_rating <= (5)::numeric)));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "valid_review_type" CHECK ((review_type = ANY (ARRAY['quarterly'::text, 'mid-year'::text, 'annual'::text, 'probation'::text, 'project'::text, 'ad-hoc'::text])));

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "valid_status" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])));

ALTER TABLE public."performance_skills" ADD CONSTRAINT "performance_skills_rating_check" CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)));

ALTER TABLE public."performance_skills" ADD CONSTRAINT "valid_skill_category" CHECK ((skill_category = ANY (ARRAY['technical'::text, 'soft'::text, 'leadership'::text, 'communication'::text, 'other'::text])));

ALTER TABLE public."performance_skills" ADD CONSTRAINT "valid_skill_rating" CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)));

ALTER TABLE public."skills_assessments" ADD CONSTRAINT "skills_assessments_rating_check" CHECK (((rating >= 1.0) AND (rating <= 5.0)));

ALTER TABLE public."time_tracking_summary" ADD CONSTRAINT "time_tracking_summary_month_check" CHECK (((month >= 1) AND (month <= 12)));

ALTER TABLE public."time_tracking_summary" ADD CONSTRAINT "time_tracking_summary_year_check" CHECK (((year >= 2000) AND (year <= 2100)));

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_completion_after_start" CHECK (((completion_date IS NULL) OR (start_date IS NULL) OR (completion_date >= start_date)));

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_quality_rating_check" CHECK (((quality_rating >= 0) AND (quality_rating <= 5)));

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text])));

ALTER TABLE public."applicants" ADD CONSTRAINT "applicants_pkey" PRIMARY KEY (id);

ALTER TABLE public."applications" ADD CONSTRAINT "applications_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_feedback" ADD CONSTRAINT "employee_feedback_pkey" PRIMARY KEY (id);

ALTER TABLE public."employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY (id);

ALTER TABLE public."goal_milestones" ADD CONSTRAINT "goal_milestones_pkey" PRIMARY KEY (id);

ALTER TABLE public."hr_notifications" ADD CONSTRAINT "hr_notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public."hr_ugc_translations" ADD CONSTRAINT "hr_ugc_translations_pkey" PRIMARY KEY (entity_type, entity_id, field, locale);

ALTER TABLE public."hr_user_permissions" ADD CONSTRAINT "hr_user_permissions_pkey" PRIMARY KEY (id);

ALTER TABLE public."hr_user_settings" ADD CONSTRAINT "hr_user_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public."hr_users" ADD CONSTRAINT "hr_users_pkey" PRIMARY KEY (id);

ALTER TABLE public."interview_schedules" ADD CONSTRAINT "interview_schedules_pkey" PRIMARY KEY (id);

ALTER TABLE public."job_applications" ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY (id);

ALTER TABLE public."job_postings" ADD CONSTRAINT "job_postings_pkey" PRIMARY KEY (id);

ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY (id);

ALTER TABLE public."open_punches" ADD CONSTRAINT "open_punches_pkey" PRIMARY KEY (employee_id);

ALTER TABLE public."overtime_logs" ADD CONSTRAINT "overtime_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public."performance_comments" ADD CONSTRAINT "performance_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public."performance_goals" ADD CONSTRAINT "performance_goals_pkey" PRIMARY KEY (id);

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_pkey" PRIMARY KEY (id);

ALTER TABLE public."performance_skills" ADD CONSTRAINT "performance_skills_pkey" PRIMARY KEY (id);

ALTER TABLE public."proof_file_audit" ADD CONSTRAINT "proof_file_audit_pkey" PRIMARY KEY (id);

ALTER TABLE public."recruitment_metrics" ADD CONSTRAINT "recruitment_metrics_pkey" PRIMARY KEY (id);

ALTER TABLE public."skills_assessments" ADD CONSTRAINT "skills_assessments_pkey" PRIMARY KEY (id);

ALTER TABLE public."time_entries" ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY (id);

ALTER TABLE public."time_tracking_summary" ADD CONSTRAINT "time_tracking_summary_pkey" PRIMARY KEY (id);

ALTER TABLE public."translation_cache" ADD CONSTRAINT "translation_cache_pkey" PRIMARY KEY (id);

ALTER TABLE public."user_emails" ADD CONSTRAINT "user_emails_pkey" PRIMARY KEY (id);

ALTER TABLE public."visits" ADD CONSTRAINT "visits_pkey" PRIMARY KEY (id);

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_pkey" PRIMARY KEY (id);

ALTER TABLE public."applicants" ADD CONSTRAINT "applicants_email_key" UNIQUE (email);

ALTER TABLE public."applications" ADD CONSTRAINT "applications_job_posting_id_applicant_id_key" UNIQUE (job_posting_id, applicant_id);

ALTER TABLE public."employees" ADD CONSTRAINT "employees_email_key" UNIQUE (email);

ALTER TABLE public."hr_user_settings" ADD CONSTRAINT "hr_user_settings_user_id_key" UNIQUE (user_id);

ALTER TABLE public."hr_users" ADD CONSTRAINT "hr_users_email_key" UNIQUE (email);

ALTER TABLE public."job_applications" ADD CONSTRAINT "unique_application" UNIQUE (job_posting_id, email);

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_employee_period_key" UNIQUE (employee_id, review_period);

ALTER TABLE public."performance_skills" ADD CONSTRAINT "performance_skills_employee_id_skill_name_key" UNIQUE (employee_id, skill_name);

ALTER TABLE public."recruitment_metrics" ADD CONSTRAINT "recruitment_metrics_job_posting_id_key" UNIQUE (job_posting_id);

ALTER TABLE public."skills_assessments" ADD CONSTRAINT "unique_employee_skill" UNIQUE (employee_id, skill_name);

ALTER TABLE public."time_entries" ADD CONSTRAINT "unique_employee_time_entry" UNIQUE (employee_id, date, clock_in);

ALTER TABLE public."time_tracking_summary" ADD CONSTRAINT "unique_employee_month_year" UNIQUE (employee_id, month, year);

ALTER TABLE public."translation_cache" ADD CONSTRAINT "translation_cache_hash_lang_unique" UNIQUE (source_hash, target_lang);

ALTER TABLE public."user_emails" ADD CONSTRAINT "user_emails_email_key" UNIQUE (email);

ALTER TABLE public."applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE;

ALTER TABLE public."applications" ADD CONSTRAINT "applications_job_posting_id_fkey" FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE;

ALTER TABLE public."applications" ADD CONSTRAINT "applications_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."employee_feedback" ADD CONSTRAINT "employee_feedback_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."employee_feedback" ADD CONSTRAINT "employee_feedback_feedback_from_fkey" FOREIGN KEY (feedback_from) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY (user_id) REFERENCES hr_users(id) ON DELETE SET NULL;

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_author_auth_id_fkey" FOREIGN KEY (author_auth_id) REFERENCES auth.users(id);

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE public."goal_check_ins" ADD CONSTRAINT "goal_check_ins_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES performance_goals(id) ON DELETE CASCADE;

ALTER TABLE public."goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES performance_goals(id) ON DELETE CASCADE;

ALTER TABLE public."hr_notifications" ADD CONSTRAINT "hr_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES hr_users(id) ON DELETE CASCADE;

ALTER TABLE public."hr_ugc_translations" ADD CONSTRAINT "hr_ugc_translations_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES hr_users(id) ON DELETE SET NULL;

ALTER TABLE public."hr_user_permissions" ADD CONSTRAINT "hr_user_permissions_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES hr_users(id) ON DELETE SET NULL;

ALTER TABLE public."hr_user_permissions" ADD CONSTRAINT "hr_user_permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES hr_users(id) ON DELETE CASCADE;

ALTER TABLE public."hr_user_settings" ADD CONSTRAINT "hr_user_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES hr_users(id) ON DELETE CASCADE;

ALTER TABLE public."hr_users" ADD CONSTRAINT "hr_users_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."interview_schedules" ADD CONSTRAINT "interview_schedules_application_id_fkey" FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE;

ALTER TABLE public."interview_schedules" ADD CONSTRAINT "interview_schedules_interviewer_id_fkey" FOREIGN KEY (interviewer_id) REFERENCES employees(id);

ALTER TABLE public."job_applications" ADD CONSTRAINT "job_applications_job_posting_id_fkey" FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE;

ALTER TABLE public."job_postings" ADD CONSTRAINT "job_postings_posted_by_fkey" FOREIGN KEY (posted_by) REFERENCES employees(id);

ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."open_punches" ADD CONSTRAINT "open_punches_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."overtime_logs" ADD CONSTRAINT "overtime_logs_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."performance_comments" ADD CONSTRAINT "performance_comments_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES performance_goals(id) ON DELETE CASCADE;

ALTER TABLE public."performance_goals" ADD CONSTRAINT "performance_goals_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."performance_goals" ADD CONSTRAINT "performance_goals_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."performance_skills" ADD CONSTRAINT "performance_skills_assessed_by_fkey" FOREIGN KEY (assessed_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."performance_skills" ADD CONSTRAINT "performance_skills_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."proof_file_audit" ADD CONSTRAINT "proof_file_audit_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE public."proof_file_audit" ADD CONSTRAINT "proof_file_audit_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES employees(id);

ALTER TABLE public."recruitment_metrics" ADD CONSTRAINT "recruitment_metrics_job_posting_id_fkey" FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE;

ALTER TABLE public."skills_assessments" ADD CONSTRAINT "skills_assessments_assessed_by_fkey" FOREIGN KEY (assessed_by) REFERENCES employees(id);

ALTER TABLE public."skills_assessments" ADD CONSTRAINT "skills_assessments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."time_entries" ADD CONSTRAINT "time_entries_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."time_entries" ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."time_tracking_summary" ADD CONSTRAINT "time_tracking_summary_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE public."user_emails" ADD CONSTRAINT "user_emails_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public."user_emails" ADD CONSTRAINT "user_emails_hr_user_id_fkey" FOREIGN KEY (hr_user_id) REFERENCES hr_users(id) ON DELETE CASCADE;

ALTER TABLE public."visits" ADD CONSTRAINT "visits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE public."workload_tasks" ADD CONSTRAINT "workload_tasks_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER SEQUENCE public."employees_id_seq" OWNED BY public."employees"."id";

ALTER SEQUENCE public."interview_schedules_id_seq" OWNED BY public."interview_schedules"."id";

ALTER SEQUENCE public."job_applications_id_seq" OWNED BY public."job_applications"."id";

ALTER SEQUENCE public."job_postings_id_seq" OWNED BY public."job_postings"."id";

ALTER SEQUENCE public."leave_requests_id_seq" OWNED BY public."leave_requests"."id";

ALTER SEQUENCE public."overtime_logs_id_seq" OWNED BY public."overtime_logs"."id";

ALTER SEQUENCE public."proof_file_audit_id_seq" OWNED BY public."proof_file_audit"."id";

ALTER SEQUENCE public."skills_assessments_id_seq" OWNED BY public."skills_assessments"."id";

ALTER SEQUENCE public."time_entries_id_seq" OWNED BY public."time_entries"."id";

ALTER SEQUENCE public."time_tracking_summary_id_seq" OWNED BY public."time_tracking_summary"."id";

ALTER SEQUENCE public."user_emails_id_seq" OWNED BY public."user_emails"."id";

ALTER SEQUENCE public."workload_tasks_id_seq" OWNED BY public."workload_tasks"."id";

CREATE INDEX idx_applicants_created_at ON public.applicants USING btree (created_at);

CREATE INDEX idx_applicants_email ON public.applicants USING btree (email);

CREATE INDEX idx_applications_applicant_id ON public.applications USING btree (applicant_id);

CREATE INDEX idx_applications_date ON public.applications USING btree (application_date);

CREATE INDEX idx_applications_job_posting_id ON public.applications USING btree (job_posting_id);

CREATE INDEX idx_applications_reviewed_by ON public.applications USING btree (reviewed_by);

CREATE INDEX idx_employee_feedback_employee_id ON public.employee_feedback USING btree (employee_id);

CREATE INDEX idx_employee_feedback_feedback_from ON public.employee_feedback USING btree (feedback_from);

CREATE INDEX idx_employees_email ON public.employees USING btree (email);

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);

CREATE INDEX goal_check_ins_goal_created_idx ON public.goal_check_ins USING btree (goal_id, created_at DESC);

CREATE INDEX idx_goal_milestones_goal_id ON public.goal_milestones USING btree (goal_id);

CREATE INDEX idx_notifications_category ON public.hr_notifications USING btree (category);

CREATE INDEX idx_notifications_is_read ON public.hr_notifications USING btree (is_read);

CREATE INDEX idx_notifications_type ON public.hr_notifications USING btree (type);

CREATE INDEX idx_notifications_user_id ON public.hr_notifications USING btree (user_id);

CREATE INDEX idx_hr_ugc_translations_entity ON public.hr_ugc_translations USING btree (entity_type, entity_id);

CREATE INDEX idx_hr_ugc_translations_locale ON public.hr_ugc_translations USING btree (locale);

CREATE INDEX idx_hr_ugc_translations_source_hash ON public.hr_ugc_translations USING btree (source_hash, locale);

CREATE UNIQUE INDEX hr_user_permissions_active_key ON public.hr_user_permissions USING btree (user_id, permission) WHERE (revoked_at IS NULL);

CREATE INDEX idx_user_settings_user_id ON public.hr_user_settings USING btree (user_id);

CREATE INDEX idx_hr_users_email ON public.hr_users USING btree (email);

CREATE INDEX idx_hr_users_employee_id ON public.hr_users USING btree (employee_id);

CREATE INDEX idx_hr_users_manager_id ON public.hr_users USING btree (manager_id);

CREATE INDEX idx_interview_schedules_application_id ON public.interview_schedules USING btree (application_id);

CREATE INDEX idx_interview_schedules_scheduled_time ON public.interview_schedules USING btree (scheduled_time);

CREATE INDEX idx_interview_schedules_status ON public.interview_schedules USING btree (status);

CREATE INDEX idx_interviews_application ON public.interview_schedules USING btree (application_id);

CREATE INDEX idx_interviews_interviewer ON public.interview_schedules USING btree (interviewer_id);

CREATE INDEX idx_interviews_scheduled_time ON public.interview_schedules USING btree (scheduled_time);

CREATE INDEX idx_interviews_status ON public.interview_schedules USING btree (status);

CREATE INDEX idx_applications_applied_date ON public.job_applications USING btree (applied_date DESC);

CREATE INDEX idx_applications_email ON public.job_applications USING btree (email);

CREATE INDEX idx_applications_job ON public.job_applications USING btree (job_posting_id);

CREATE INDEX idx_applications_stage ON public.job_applications USING btree (stage);

CREATE INDEX idx_applications_status ON public.job_applications USING btree (status);

CREATE INDEX idx_job_postings_department ON public.job_postings USING btree (department);

CREATE INDEX idx_job_postings_posted_by ON public.job_postings USING btree (posted_by);

CREATE INDEX idx_job_postings_posted_date ON public.job_postings USING btree (posted_date DESC);

CREATE INDEX idx_job_postings_status ON public.job_postings USING btree (status);

CREATE INDEX idx_leave_requests_approved_by ON public.leave_requests USING btree (approved_by) WHERE (approved_by IS NOT NULL);

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);

CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests USING btree (employee_id);

CREATE INDEX idx_leave_requests_employee_start_date ON public.leave_requests USING btree (employee_id, start_date);

CREATE INDEX idx_leave_requests_with_proof ON public.leave_requests USING btree (employee_id, start_date) WHERE (proof_file_url IS NOT NULL);

CREATE INDEX idx_open_punches_date ON public.open_punches USING btree (date);

CREATE INDEX idx_overtime_logs_approved_by ON public.overtime_logs USING btree (approved_by) WHERE (approved_by IS NOT NULL);

CREATE INDEX idx_overtime_logs_employee ON public.overtime_logs USING btree (employee_id);

CREATE INDEX idx_overtime_logs_employee_date ON public.overtime_logs USING btree (employee_id, date);

CREATE INDEX idx_overtime_logs_employee_id ON public.overtime_logs USING btree (employee_id);

CREATE INDEX idx_performance_comments_goal ON public.performance_comments USING btree (goal_id);

CREATE INDEX idx_performance_goals_assigned_by ON public.performance_goals USING btree (assigned_by);

CREATE INDEX idx_performance_goals_employee ON public.performance_goals USING btree (employee_id);

CREATE INDEX idx_performance_goals_status ON public.performance_goals USING btree (status);

CREATE INDEX idx_performance_goals_target_date ON public.performance_goals USING btree (target_date);

CREATE INDEX idx_performance_reviews_date ON public.performance_reviews USING btree (review_date);

CREATE INDEX idx_performance_reviews_employee ON public.performance_reviews USING btree (employee_id);

CREATE INDEX idx_performance_reviews_employee_id ON public.performance_reviews USING btree (employee_id);

CREATE INDEX idx_performance_reviews_review_date ON public.performance_reviews USING btree (review_date);

CREATE INDEX idx_performance_reviews_reviewer_id ON public.performance_reviews USING btree (reviewer_id);

CREATE INDEX idx_performance_reviews_status ON public.performance_reviews USING btree (status);

CREATE INDEX idx_performance_skills_assessed_by ON public.performance_skills USING btree (assessed_by);

CREATE INDEX idx_performance_skills_category ON public.performance_skills USING btree (skill_category);

CREATE INDEX idx_performance_skills_employee ON public.performance_skills USING btree (employee_id);

CREATE INDEX idx_proof_audit_created ON public.proof_file_audit USING btree (created_at);

CREATE INDEX idx_proof_audit_employee ON public.proof_file_audit USING btree (employee_id);

CREATE INDEX idx_proof_audit_entity ON public.proof_file_audit USING btree (entity_type, entity_id);

CREATE INDEX idx_proof_file_audit_created_at ON public.proof_file_audit USING btree (created_at);

CREATE INDEX idx_proof_file_audit_employee_id ON public.proof_file_audit USING btree (employee_id);

CREATE INDEX idx_proof_file_audit_entity ON public.proof_file_audit USING btree (entity_type, entity_id);

CREATE INDEX idx_proof_file_audit_operation ON public.proof_file_audit USING btree (operation);

CREATE INDEX idx_proof_file_audit_performed_by ON public.proof_file_audit USING btree (performed_by);

CREATE INDEX idx_skills_assessments_assessed_by ON public.skills_assessments USING btree (assessed_by);

CREATE INDEX idx_skills_category ON public.skills_assessments USING btree (skill_category);

CREATE INDEX idx_skills_employee ON public.skills_assessments USING btree (employee_id);

CREATE INDEX idx_skills_name ON public.skills_assessments USING btree (skill_name);

CREATE INDEX idx_time_entries_approved_by ON public.time_entries USING btree (approved_by) WHERE (approved_by IS NOT NULL);

CREATE INDEX idx_time_entries_employee_date ON public.time_entries USING btree (employee_id, date);

CREATE INDEX idx_time_entries_employee_id ON public.time_entries USING btree (employee_id);

CREATE INDEX idx_time_entries_status ON public.time_entries USING btree (status);

CREATE INDEX idx_time_entries_with_proof ON public.time_entries USING btree (employee_id, date) WHERE (proof_file_url IS NOT NULL);

CREATE INDEX idx_time_summary_employee_period ON public.time_tracking_summary USING btree (employee_id, year, month);

CREATE INDEX idx_time_tracking_summary_employee_id ON public.time_tracking_summary USING btree (employee_id);

CREATE INDEX idx_translation_cache_lookup ON public.translation_cache USING btree (source_hash, target_lang);

CREATE INDEX idx_translation_cache_updated_at ON public.translation_cache USING btree (updated_at DESC);

CREATE INDEX idx_user_emails_auth_user_id ON public.user_emails USING btree (auth_user_id);

CREATE INDEX idx_user_emails_email ON public.user_emails USING btree (email);

CREATE INDEX idx_user_emails_hr_user_id ON public.user_emails USING btree (hr_user_id);

CREATE UNIQUE INDEX user_emails_primary_idx ON public.user_emails USING btree (auth_user_id) WHERE (is_primary = true);

CREATE INDEX idx_visits_created_at ON public.visits USING btree (created_at DESC);

CREATE INDEX idx_visits_ip ON public.visits USING btree (ip);

CREATE INDEX idx_visits_is_demo ON public.visits USING btree (is_demo);

CREATE INDEX idx_visits_user_id ON public.visits USING btree (user_id);

CREATE INDEX idx_workload_tasks_created_by ON public.workload_tasks USING btree (created_by);

CREATE INDEX idx_workload_tasks_due_date ON public.workload_tasks USING btree (due_date);

CREATE INDEX idx_workload_tasks_employee_id ON public.workload_tasks USING btree (employee_id);

CREATE INDEX idx_workload_tasks_priority ON public.workload_tasks USING btree (priority);

CREATE INDEX idx_workload_tasks_status ON public.workload_tasks USING btree (status);

CREATE OR REPLACE FUNCTION private.can_manage_employee(target_employee_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.hr_users actor
    where actor.id = private.current_hr_user_id()
      and actor.is_active is true
      and lower(coalesce(actor.employment_status, 'active')) not in ('terminated', 'inactive')
      and (
        lower(actor.role::text) = 'admin'
        or (
          lower(actor.role::text) = 'manager'
          and exists (
            select 1
            from public.hr_users target
            where target.employee_id = target_employee_id
              and (
                target.manager_id = actor.id
                or (
                  actor.department is not null
                  and target.department = actor.department
                )
              )
          )
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.can_manage_employee(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.can_manage_employee(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION private.can_manage_employee(text) TO "service_role";

CREATE OR REPLACE FUNCTION private.current_employee_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select hu.employee_id
  from public.hr_users hu
  where hu.id = private.current_hr_user_id()
    and hu.is_active is true
    and lower(coalesce(hu.employment_status, 'active')) not in ('terminated', 'inactive')
  limit 1;
$function$;

REVOKE ALL ON FUNCTION private.current_employee_id() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.current_employee_id() TO "authenticated";

GRANT EXECUTE ON FUNCTION private.current_employee_id() TO "service_role";

CREATE OR REPLACE FUNCTION private.current_hr_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select lower(hu.role::text)
  from public.hr_users hu
  where hu.id = private.current_hr_user_id()
    and hu.is_active is true
    and lower(coalesce(hu.employment_status, 'active')) not in ('terminated', 'inactive')
  limit 1;
$function$;

REVOKE ALL ON FUNCTION private.current_hr_role() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.current_hr_role() TO "authenticated";

GRANT EXECUTE ON FUNCTION private.current_hr_role() TO "service_role";

CREATE OR REPLACE FUNCTION private.current_hr_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select ue.hr_user_id
      from public.user_emails ue
      where ue.auth_user_id = (select auth.uid())
      order by ue.is_primary desc nulls last, ue.id
      limit 1
    ),
    (
      select hu.id
      from public.hr_users hu
      where hu.id = (select auth.uid())
      limit 1
    )
  );
$function$;

REVOKE ALL ON FUNCTION private.current_hr_user_id() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.current_hr_user_id() TO "authenticated";

GRANT EXECUTE ON FUNCTION private.current_hr_user_id() TO "service_role";

CREATE OR REPLACE FUNCTION private.enforce_employee_approval_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.jwt() ->> 'role') = 'service_role'
    or ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin'))
    or private.can_manage_employee(old.employee_id)
  then
    return new;
  end if;

  if old.employee_id <> private.current_employee_id() then
    raise exception 'Employee record is outside the current user scope';
  end if;

  if new.employee_id is distinct from old.employee_id
    or new.status is distinct from old.status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  then
    raise exception 'Employees cannot change ownership or approval fields';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.enforce_employee_approval_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.enforce_employee_approval_update() TO "public";

CREATE OR REPLACE FUNCTION private.enforce_employee_goal_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.jwt() ->> 'role') = 'service_role'
    or ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin'))
    or private.can_manage_employee(old.employee_id)
  then
    return new;
  end if;

  if old.employee_id <> private.current_employee_id() then
    raise exception 'Goal is outside the current user scope';
  end if;

  if new.employee_id is distinct from old.employee_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.target_date is distinct from old.target_date
    or new.assigned_by is distinct from old.assigned_by
    or new.priority is distinct from old.priority
    or new.category is distinct from old.category
    or new.assigned_date is distinct from old.assigned_date
    or new.notes is distinct from old.notes
    or new.success_criteria is distinct from old.success_criteria
    or new.related_review_id is distinct from old.related_review_id
  then
    raise exception 'Employees may only update progress and check-in fields on goals';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.enforce_employee_goal_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.enforce_employee_goal_update() TO "public";

CREATE OR REPLACE FUNCTION private.enforce_employee_workload_task_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.jwt() ->> 'role') = 'service_role'
    or ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin'))
    or private.can_manage_employee(old.employee_id)
  then
    return new;
  end if;

  if old.employee_id <> private.current_employee_id() then
    raise exception 'Work item is outside the current user scope';
  end if;

  if new.employee_id is distinct from old.employee_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.due_date is distinct from old.due_date
    or new.priority is distinct from old.priority
    or new.created_by is distinct from old.created_by
  then
    raise exception 'Employees may only update the status of assigned company tasks';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.enforce_employee_workload_task_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.enforce_employee_workload_task_update() TO "public";

CREATE OR REPLACE FUNCTION private.enforce_hr_user_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_role text;
begin
  if (select auth.jwt() ->> 'role') = 'service_role'
    or ((select auth.uid()) is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  actor_role := private.current_hr_role();
  if actor_role = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.salary is distinct from old.salary
    or new.is_active is distinct from old.is_active
    or new.employment_status is distinct from old.employment_status
    or new.employee_id is distinct from old.employee_id
  then
    raise exception 'Only HR administrators can change identity, role, salary, or account status';
  end if;

  if actor_role <> 'manager' and (
    new.department is distinct from old.department
    or new.position is distinct from old.position
    or new.manager_id is distinct from old.manager_id
  ) then
    raise exception 'Only managers or HR administrators can change organization placement';
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.enforce_hr_user_sensitive_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.enforce_hr_user_sensitive_update() TO "public";

CREATE OR REPLACE FUNCTION private.has_hr_permission(requested_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.hr_user_permissions hup
    join public.hr_users hu on hu.id = hup.user_id
    where hup.user_id = private.current_hr_user_id()
      and hup.permission = requested_permission
      and hup.revoked_at is null
      and hu.is_active is true
      and lower(coalesce(hu.employment_status, 'active')) not in ('terminated', 'inactive')
  );
$function$;

REVOKE ALL ON FUNCTION private.has_hr_permission(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.has_hr_permission(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION private.has_hr_permission(text) TO "service_role";

CREATE OR REPLACE FUNCTION private.is_active_hr_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.hr_users hu
    where hu.id = private.current_hr_user_id()
      and hu.is_active is true
      and lower(coalesce(hu.employment_status, 'active')) not in ('terminated', 'inactive')
  );
$function$;

REVOKE ALL ON FUNCTION private.is_active_hr_user() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.is_active_hr_user() TO "authenticated";

GRANT EXECUTE ON FUNCTION private.is_active_hr_user() TO "service_role";

CREATE OR REPLACE FUNCTION private.is_hr_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select private.current_hr_role()) = 'admin', false)
$function$;

REVOKE ALL ON FUNCTION private.is_hr_admin() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.is_hr_admin() TO "authenticated";

CREATE OR REPLACE FUNCTION public.add_user_email(p_hr_user_id uuid, p_auth_user_id uuid, p_email character varying, p_is_primary boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result JSON;
BEGIN
  -- Insert the new email
  INSERT INTO user_emails (hr_user_id, auth_user_id, email, is_primary)
  VALUES (p_hr_user_id, p_auth_user_id, p_email, p_is_primary)
  ON CONFLICT (email) DO UPDATE
  SET hr_user_id = EXCLUDED.hr_user_id,
      auth_user_id = EXCLUDED.auth_user_id,
      is_primary = EXCLUDED.is_primary;
  
  -- If this is set as primary, update other emails for this user
  IF p_is_primary THEN
    UPDATE user_emails
    SET is_primary = false
    WHERE hr_user_id = p_hr_user_id AND email != p_email;
    
    -- Update hr_users primary_email
    UPDATE hr_users
    SET primary_email = p_email,
        email = p_email
    WHERE id = p_hr_user_id;
  END IF;
  
  result := json_build_object(
    'success', true,
    'message', 'Email added successfully'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := json_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_user_email(uuid,uuid,character varying,boolean) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.add_user_email(uuid,uuid,character varying,boolean) TO "public";

GRANT EXECUTE ON FUNCTION public.add_user_email(uuid,uuid,character varying,boolean) TO "anon";

GRANT EXECUTE ON FUNCTION public.add_user_email(uuid,uuid,character varying,boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.add_user_email(uuid,uuid,character varying,boolean) TO "service_role";

CREATE OR REPLACE FUNCTION public.auto_close_expired_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Auto close jobs past closing date
    IF NEW.closing_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'closed';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_close_expired_jobs() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.auto_close_expired_jobs() TO "public";

GRANT EXECUTE ON FUNCTION public.auto_close_expired_jobs() TO "anon";

GRANT EXECUTE ON FUNCTION public.auto_close_expired_jobs() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.auto_close_expired_jobs() TO "service_role";

CREATE OR REPLACE FUNCTION public.calculate_leave_days()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.days_count := calculate_working_days(NEW.start_date, NEW.end_date);
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_leave_days() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_leave_days() TO "public";

GRANT EXECUTE ON FUNCTION public.calculate_leave_days() TO "anon";

GRANT EXECUTE ON FUNCTION public.calculate_leave_days() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.calculate_leave_days() TO "service_role";

CREATE OR REPLACE FUNCTION public.calculate_working_days(start_date date, end_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    total_days DECIMAL := 0;
    curr_date DATE := start_date;
BEGIN
    WHILE curr_date <= end_date LOOP
        -- Count only weekdays (Monday=1 to Friday=5)
        IF EXTRACT(DOW FROM curr_date) BETWEEN 1 AND 5 THEN
            total_days := total_days + 1;
        END IF;

        curr_date := curr_date + INTERVAL '1 day';
    END LOOP;

    RETURN total_days;
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_working_days(date,date) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_working_days(date,date) TO "public";

GRANT EXECUTE ON FUNCTION public.calculate_working_days(date,date) TO "anon";

GRANT EXECUTE ON FUNCTION public.calculate_working_days(date,date) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.calculate_working_days(date,date) TO "service_role";

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications(p_days integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM hr_notifications
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days
  OR (expires_at IS NOT NULL AND expires_at < NOW());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_notifications(integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) TO "public";

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) TO "anon";

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications(integer) TO "service_role";

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title character varying, p_message text, p_type character varying DEFAULT 'info'::character varying, p_category character varying DEFAULT 'general'::character varying, p_action_url character varying DEFAULT NULL::character varying, p_action_label character varying DEFAULT NULL::character varying, p_metadata jsonb DEFAULT '{}'::jsonb, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$  -- Changed to UUID
DECLARE
  v_notification_id UUID;  -- Changed to UUID
BEGIN
  INSERT INTO hr_notifications (
    user_id, title, message, type, category, 
    action_url, action_label, metadata, expires_at
  )
  VALUES (
    p_user_id, p_title, p_message, p_type, p_category,
    p_action_url, p_action_label, p_metadata, p_expires_at
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_notification(uuid,character varying,text,character varying,character varying,character varying,character varying,jsonb,timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid,character varying,text,character varying,character varying,character varying,character varying,jsonb,timestamp with time zone) TO "public";

GRANT EXECUTE ON FUNCTION public.create_notification(uuid,character varying,text,character varying,character varying,character varying,character varying,jsonb,timestamp with time zone) TO "anon";

GRANT EXECUTE ON FUNCTION public.create_notification(uuid,character varying,text,character varying,character varying,character varying,character varying,jsonb,timestamp with time zone) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.create_notification(uuid,character varying,text,character varying,character varying,character varying,character varying,jsonb,timestamp with time zone) TO "service_role";

CREATE OR REPLACE FUNCTION public.create_user_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO hr_user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_user_settings() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_user_settings() TO "public";

GRANT EXECUTE ON FUNCTION public.create_user_settings() TO "anon";

GRANT EXECUTE ON FUNCTION public.create_user_settings() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.create_user_settings() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_auth_uid()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid()::uuid;
$function$;

REVOKE ALL ON FUNCTION public.get_auth_uid() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_auth_uid() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_auth_user_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.uid()::uuid;
$function$;

REVOKE ALL ON FUNCTION public.get_auth_user_id() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_auth_user_id() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_employee_directory()
 RETURNS TABLE(id text, name text, "position" text, department text, status text, photo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id, e.name::text, e.position::text, e.department::text, e.status::text, e.photo
  from public.employees e
  where private.is_active_hr_user()
    and lower(coalesce(e.status::text, 'active')) <> 'inactive'
  order by e.name;
$function$;

REVOKE ALL ON FUNCTION public.get_employee_directory() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.get_employee_directory() TO "service_role";

CREATE OR REPLACE FUNCTION public.get_hr_user_id_from_auth(auth_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result UUID;
BEGIN
  SELECT hr_user_id INTO result
  FROM user_emails
  WHERE auth_user_id = auth_id
  LIMIT 1;
  
  -- If not found in user_emails, check if it's directly in hr_users
  IF result IS NULL THEN
    SELECT id INTO result
    FROM hr_users
    WHERE id = auth_id;
  END IF;
  
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_hr_user_id_from_auth(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_hr_user_id_from_auth(uuid) TO "public";

GRANT EXECUTE ON FUNCTION public.get_hr_user_id_from_auth(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public.get_hr_user_id_from_auth(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.get_hr_user_id_from_auth(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.get_primary_email(hr_user_uuid uuid)
 RETURNS character varying
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result VARCHAR;
BEGIN
  SELECT email INTO result
  FROM user_emails
  WHERE hr_user_id = hr_user_uuid AND is_primary = true
  LIMIT 1;
  
  -- Fallback to hr_users.email if not found
  IF result IS NULL THEN
    SELECT email INTO result
    FROM hr_users
    WHERE id = hr_user_uuid;
  END IF;
  
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_primary_email(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_primary_email(uuid) TO "public";

GRANT EXECUTE ON FUNCTION public.get_primary_email(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public.get_primary_email(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.get_primary_email(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.hr_can_translate(p_entity_type text, p_entity_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id TEXT;
  v_owner_id    TEXT;
  v_role        TEXT;
BEGIN
  SELECT hu.employee_id::TEXT, hu.role
    INTO v_employee_id, v_role
    FROM public.hr_users hu
   WHERE hu.id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('admin', 'manager') THEN
    RETURN TRUE;
  END IF;

  -- Not privileged: fall through to ownership of the specific record.
  --
  -- The comparison casts the key to TEXT rather than casting p_entity_id to the
  -- key's type. That gives up the primary-key index, but the alternative throws
  -- invalid_text_representation on any malformed id — turning what should be a
  -- clean denial into a 500 that a caller can use to probe key types.
  CASE p_entity_type
    WHEN 'task' THEN
      SELECT employee_id::TEXT INTO v_owner_id
        FROM public.workload_tasks WHERE id::TEXT = p_entity_id;
    WHEN 'goal' THEN
      SELECT employee_id::TEXT INTO v_owner_id
        FROM public.performance_goals WHERE id::TEXT = p_entity_id;
    WHEN 'review' THEN
      SELECT employee_id::TEXT INTO v_owner_id
        FROM public.performance_reviews WHERE id::TEXT = p_entity_id;
    WHEN 'leave' THEN
      SELECT employee_id::TEXT INTO v_owner_id
        FROM public.leave_requests WHERE id::TEXT = p_entity_id;
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN v_owner_id IS NOT NULL AND v_owner_id = v_employee_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_can_translate(text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hr_can_translate(text,text) TO "anon";

GRANT EXECUTE ON FUNCTION public.hr_can_translate(text,text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.hr_can_translate(text,text) TO "service_role";

CREATE OR REPLACE FUNCTION public.hr_ugc_source_hash(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT encode(sha256(convert_to(btrim(COALESCE(p_text, '')), 'UTF8')), 'hex');
$function$;

REVOKE ALL ON FUNCTION public.hr_ugc_source_hash(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hr_ugc_source_hash(text) TO "public";

GRANT EXECUTE ON FUNCTION public.hr_ugc_source_hash(text) TO "anon";

GRANT EXECUTE ON FUNCTION public.hr_ugc_source_hash(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.hr_ugc_source_hash(text) TO "service_role";

CREATE OR REPLACE FUNCTION public.hr_ugc_translations_prune()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  DELETE FROM public.hr_ugc_translations
   WHERE entity_type = TG_ARGV[0]
     AND entity_id = OLD.id::TEXT;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_ugc_translations_prune() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_prune() TO "public";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_prune() TO "anon";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_prune() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_prune() TO "service_role";

CREATE OR REPLACE FUNCTION public.hr_ugc_translations_set_hash()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.source_hash := public.hr_ugc_source_hash(NEW.source_text);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.hr_ugc_translations_set_hash() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_set_hash() TO "public";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_set_hash() TO "anon";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_set_hash() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.hr_ugc_translations_set_hash() TO "service_role";

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hr_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id AND is_read = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO "public";

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE hr_notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id;
  
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO "public";

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.record_visit(p_path text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_ip_region text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_is_proxy boolean DEFAULT false, p_is_vpn boolean DEFAULT false, p_is_hosting boolean DEFAULT false, p_connection_type text DEFAULT 'unknown'::text, p_is_demo boolean DEFAULT false, p_role text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  new_id uuid;
  uid uuid;
BEGIN
  uid := auth.uid();

  IF NOT p_is_demo AND uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record a visit';
  END IF;

  INSERT INTO public.visits (
    path,
    referrer,
    user_agent,
    ip,
    ip_region,
    is_proxy,
    is_vpn,
    is_hosting,
    connection_type,
    is_demo,
    role,
    user_id
  )
  VALUES (
    p_path,
    p_referrer,
    p_user_agent,
    CASE WHEN p_is_demo THEN NULL ELSE p_ip END,
    p_ip_region,
    COALESCE(p_is_proxy, false),
    COALESCE(p_is_vpn, false),
    COALESCE(p_is_hosting, false),
    COALESCE(NULLIF(p_connection_type, ''), 'unknown'),
    COALESCE(p_is_demo, false),
    p_role,
    CASE WHEN p_is_demo THEN NULL ELSE uid END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_visit(text,text,text,text,text,boolean,boolean,boolean,text,boolean,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.record_visit(text,text,text,text,text,boolean,boolean,boolean,text,boolean,text) TO "public";

GRANT EXECUTE ON FUNCTION public.record_visit(text,text,text,text,text,boolean,boolean,boolean,text,boolean,text) TO "anon";

GRANT EXECUTE ON FUNCTION public.record_visit(text,text,text,text,text,boolean,boolean,boolean,text,boolean,text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.record_visit(text,text,text,text,text,boolean,boolean,boolean,text,boolean,text) TO "service_role";

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT
      employee_id,
      EXTRACT(MONTH FROM date)::integer AS month,
      EXTRACT(YEAR FROM date)::integer AS year
    FROM old_time_entries
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_time_entry_summaries_after_delete() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_delete() TO "public";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_delete() TO "anon";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_delete() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_delete() TO "service_role";

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT
      employee_id,
      EXTRACT(MONTH FROM date)::integer AS month,
      EXTRACT(YEAR FROM date)::integer AS year
    FROM new_time_entries
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_time_entry_summaries_after_insert() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_insert() TO "public";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_insert() TO "anon";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_insert() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_insert() TO "service_role";

CREATE OR REPLACE FUNCTION public.refresh_time_entry_summaries_after_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period record;
BEGIN
  FOR v_period IN
    SELECT DISTINCT affected.employee_id, affected.month, affected.year
    FROM (
      SELECT
        employee_id,
        EXTRACT(MONTH FROM date)::integer AS month,
        EXTRACT(YEAR FROM date)::integer AS year
      FROM old_time_entries
      UNION
      SELECT
        employee_id,
        EXTRACT(MONTH FROM date)::integer AS month,
        EXTRACT(YEAR FROM date)::integer AS year
      FROM new_time_entries
    ) AS affected
  LOOP
    PERFORM public.update_time_tracking_summary(
      v_period.employee_id,
      v_period.month,
      v_period.year
    );
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_time_entry_summaries_after_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_update() TO "public";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_update() TO "anon";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_update() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.refresh_time_entry_summaries_after_update() TO "service_role";

CREATE OR REPLACE FUNCTION public.sync_performance_goal_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.progress_percentage := COALESCE(NEW.progress_percentage, 0);
    NEW.progress := NEW.progress_percentage;
  ELSIF NEW.progress_percentage IS DISTINCT FROM OLD.progress_percentage THEN
    NEW.progress := NEW.progress_percentage;
  ELSIF NEW.progress IS DISTINCT FROM OLD.progress THEN
    NEW.progress_percentage := NEW.progress;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_performance_goal_progress() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sync_performance_goal_progress() TO "public";

GRANT EXECUTE ON FUNCTION public.sync_performance_goal_progress() TO "anon";

GRANT EXECUTE ON FUNCTION public.sync_performance_goal_progress() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.sync_performance_goal_progress() TO "service_role";

CREATE OR REPLACE FUNCTION public.trigger_update_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_date DATE;
BEGIN
    -- Determine which date field to use based on the table
    -- time_entries and overtime_logs use 'date'
    -- leave_requests uses 'start_date'
    IF TG_TABLE_NAME = 'leave_requests' THEN
        v_date := COALESCE(NEW.start_date, OLD.start_date);
    ELSE
        v_date := COALESCE(NEW.date, OLD.date);
    END IF;

    -- Update the summary
    PERFORM update_time_tracking_summary(
        COALESCE(NEW.employee_id, OLD.employee_id),
        EXTRACT(MONTH FROM v_date)::INTEGER,
        EXTRACT(YEAR FROM v_date)::INTEGER
    );
    
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.trigger_update_summary() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.trigger_update_summary() TO "public";

GRANT EXECUTE ON FUNCTION public.trigger_update_summary() TO "anon";

GRANT EXECUTE ON FUNCTION public.trigger_update_summary() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.trigger_update_summary() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_application_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Auto-update stage based on status
    IF NEW.status IN ('applied', 'screening') THEN
        NEW.stage := 'screening';
    ELSIF NEW.status = 'interview_scheduled' THEN
        -- Keep existing stage or set to phone_screen
        IF NEW.stage IS NULL OR NEW.stage = 'screening' THEN
            NEW.stage := 'phone_screen';
        END IF;
    ELSIF NEW.status = 'technical' THEN
        NEW.stage := 'technical';
    ELSIF NEW.status = 'hr_round' THEN
        NEW.stage := 'hr_round';
    ELSIF NEW.status = 'offer' THEN
        NEW.stage := 'offer';
    ELSIF NEW.status = 'hired' THEN
        NEW.stage := 'hired';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_application_stage() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_application_stage() TO "public";

GRANT EXECUTE ON FUNCTION public.update_application_stage() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_application_stage() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_application_stage() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_performance_reviews_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_performance_reviews_updated_at() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_performance_reviews_updated_at() TO "public";

GRANT EXECUTE ON FUNCTION public.update_performance_reviews_updated_at() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_performance_reviews_updated_at() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_performance_reviews_updated_at() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_performance_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_performance_updated_at() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_performance_updated_at() TO "public";

GRANT EXECUTE ON FUNCTION public.update_performance_updated_at() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_performance_updated_at() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_performance_updated_at() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_recruitment_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Insert or update metrics for the job posting
  INSERT INTO recruitment_metrics (
    job_posting_id,
    total_applications,
    under_review,
    shortlisted,
    interviews_scheduled,
    offers_extended,
    hired,
    rejected
  )
  SELECT 
    NEW.job_posting_id,
    COUNT(*) as total_applications,
    COUNT(*) FILTER (WHERE status = 'under review') as under_review,
    COUNT(*) FILTER (WHERE status = 'shortlisted') as shortlisted,
    COUNT(*) FILTER (WHERE status = 'interview scheduled') as interviews_scheduled,
    COUNT(*) FILTER (WHERE status = 'offer extended') as offers_extended,
    COUNT(*) FILTER (WHERE status = 'hired') as hired,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
  FROM applications
  WHERE job_posting_id = NEW.job_posting_id
  ON CONFLICT (job_posting_id) DO UPDATE SET
    total_applications = EXCLUDED.total_applications,
    under_review = EXCLUDED.under_review,
    shortlisted = EXCLUDED.shortlisted,
    interviews_scheduled = EXCLUDED.interviews_scheduled,
    offers_extended = EXCLUDED.offers_extended,
    hired = EXCLUDED.hired,
    rejected = EXCLUDED.rejected,
    last_updated = CURRENT_TIMESTAMP;
    
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_recruitment_metrics() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_recruitment_metrics() TO "public";

GRANT EXECUTE ON FUNCTION public.update_recruitment_metrics() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_recruitment_metrics() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_recruitment_metrics() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_time_tracking_summary(p_employee_id text, p_month integer, p_year integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_period_start date := make_date(p_year, p_month, 1);
  v_period_end date := (v_period_start + interval '1 month')::date;
  v_days_worked integer := 0;
  v_leave_days numeric := 0;
  v_regular_hours numeric := 0;
  v_overtime_hours numeric := 0;
  v_holiday_overtime_hours numeric := 0;
  v_overtime_log_hours numeric := 0;
  v_holiday_overtime_log_hours numeric := 0;
  v_total_hours numeric := 0;
  v_attendance_rate numeric := 0;
  v_working_days integer := 22;
BEGIN
  SELECT
    COUNT(DISTINCT date) FILTER (
      WHERE hour_type IS NULL
        OR hour_type NOT IN ('on_leave', 'vacation', 'sick_leave')
    ),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IN ('regular', 'wfh')
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IN ('weekend', 'bonus', 'overtime')
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type = 'holiday'
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE hour_type IS NULL
        OR hour_type NOT IN ('on_leave', 'vacation', 'sick_leave')
    ), 0)
  INTO
    v_days_worked,
    v_regular_hours,
    v_overtime_hours,
    v_holiday_overtime_hours,
    v_total_hours
  FROM public.time_entries
  WHERE employee_id = p_employee_id
    AND date >= v_period_start
    AND date < v_period_end
    AND status IN ('pending', 'approved');

  SELECT COALESCE(SUM(days_count), 0)
  INTO v_leave_days
  FROM public.leave_requests
  WHERE employee_id = p_employee_id
    AND start_date >= v_period_start
    AND start_date < v_period_end
    AND status = 'approved';

  SELECT
    COALESCE(SUM(hours) FILTER (
      WHERE overtime_type IS DISTINCT FROM 'holiday'
    ), 0),
    COALESCE(SUM(hours) FILTER (
      WHERE overtime_type = 'holiday'
    ), 0)
  INTO
    v_overtime_log_hours,
    v_holiday_overtime_log_hours
  FROM public.overtime_logs
  WHERE employee_id = p_employee_id
    AND date >= v_period_start
    AND date < v_period_end
    AND status IN ('pending', 'approved');

  v_overtime_hours := v_overtime_hours + v_overtime_log_hours;
  v_holiday_overtime_hours :=
    v_holiday_overtime_hours + v_holiday_overtime_log_hours;
  v_total_hours :=
    v_total_hours + v_overtime_log_hours + v_holiday_overtime_log_hours;

  IF v_working_days > 0 THEN
    v_attendance_rate := LEAST(
      ((v_days_worked + v_leave_days) / v_working_days::numeric) * 100,
      100
    );
  END IF;

  INSERT INTO public.time_tracking_summary (
    employee_id,
    month,
    year,
    days_worked,
    leave_days,
    regular_hours,
    overtime_hours,
    holiday_overtime_hours,
    total_hours,
    attendance_rate
  )
  VALUES (
    p_employee_id,
    p_month,
    p_year,
    v_days_worked,
    v_leave_days,
    v_regular_hours,
    v_overtime_hours,
    v_holiday_overtime_hours,
    v_total_hours,
    v_attendance_rate
  )
  ON CONFLICT (employee_id, month, year)
  DO UPDATE SET
    days_worked = EXCLUDED.days_worked,
    leave_days = EXCLUDED.leave_days,
    regular_hours = EXCLUDED.regular_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    holiday_overtime_hours = EXCLUDED.holiday_overtime_hours,
    total_hours = EXCLUDED.total_hours,
    attendance_rate = EXCLUDED.attendance_rate,
    updated_at = CURRENT_TIMESTAMP;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_time_tracking_summary(text,integer,integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_time_tracking_summary(text,integer,integer) TO "public";

GRANT EXECUTE ON FUNCTION public.update_time_tracking_summary(text,integer,integer) TO "anon";

GRANT EXECUTE ON FUNCTION public.update_time_tracking_summary(text,integer,integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_time_tracking_summary(text,integer,integer) TO "service_role";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "public";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO "service_role";

CREATE OR REPLACE FUNCTION public.update_workload_tasks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_workload_tasks_updated_at() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_workload_tasks_updated_at() TO "public";

GRANT EXECUTE ON FUNCTION public.update_workload_tasks_updated_at() TO "anon";

GRANT EXECUTE ON FUNCTION public.update_workload_tasks_updated_at() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.update_workload_tasks_updated_at() TO "service_role";

CREATE OR REPLACE FUNCTION private.reminder_set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION private.reminder_set_updated_at() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER update_applicants_updated_at BEFORE UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_recruitment_metrics AFTER INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_recruitment_metrics();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER reminder_touch_updated_at BEFORE UPDATE ON public.goal_check_ins FOR EACH ROW EXECUTE FUNCTION private.reminder_set_updated_at();

CREATE TRIGGER trg_hr_ugc_translations_hash BEFORE INSERT OR UPDATE ON public.hr_ugc_translations FOR EACH ROW EXECUTE FUNCTION hr_ugc_translations_set_hash();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.hr_user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER create_settings_for_new_user AFTER INSERT ON public.hr_users FOR EACH ROW EXECUTE FUNCTION create_user_settings();

CREATE TRIGGER hr_users_sensitive_update_guard BEFORE UPDATE ON public.hr_users FOR EACH ROW EXECUTE FUNCTION private.enforce_hr_user_sensitive_update();

CREATE TRIGGER update_hr_users_updated_at BEFORE UPDATE ON public.hr_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_schedules_updated_at BEFORE UPDATE ON public.interview_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_update_stage BEFORE INSERT OR UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION update_application_stage();

CREATE TRIGGER check_job_closing_date BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION auto_close_expired_jobs();

CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_calculate_leave_days BEFORE INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION calculate_leave_days();

CREATE TRIGGER employee_approval_update_guard BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_approval_update();

CREATE TRIGGER trg_prune_ugc_translations AFTER DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION hr_ugc_translations_prune('leave');

CREATE TRIGGER update_summary_on_leave AFTER INSERT OR DELETE OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER update_open_punches_updated_at BEFORE UPDATE ON public.open_punches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER employee_approval_update_guard BEFORE UPDATE ON public.overtime_logs FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_approval_update();

CREATE TRIGGER update_summary_on_overtime AFTER INSERT OR DELETE OR UPDATE ON public.overtime_logs FOR EACH ROW EXECUTE FUNCTION trigger_update_summary();

CREATE TRIGGER employee_work_item_update_guard BEFORE UPDATE ON public.performance_goals FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_goal_update();

CREATE TRIGGER sync_performance_goal_progress_columns BEFORE INSERT OR UPDATE OF progress, progress_percentage ON public.performance_goals FOR EACH ROW EXECUTE FUNCTION sync_performance_goal_progress();

CREATE TRIGGER trg_prune_ugc_translations AFTER DELETE ON public.performance_goals FOR EACH ROW EXECUTE FUNCTION hr_ugc_translations_prune('goal');

CREATE TRIGGER trigger_performance_goals_updated_at BEFORE UPDATE ON public.performance_goals FOR EACH ROW EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trg_prune_ugc_translations AFTER DELETE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION hr_ugc_translations_prune('review');

CREATE TRIGGER trigger_performance_reviews_updated_at BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER trigger_update_performance_reviews_updated_at BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION update_performance_reviews_updated_at();

CREATE TRIGGER trigger_performance_skills_updated_at BEFORE UPDATE ON public.performance_skills FOR EACH ROW EXECUTE FUNCTION update_performance_updated_at();

CREATE TRIGGER employee_approval_update_guard BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_approval_update();

CREATE TRIGGER update_summary_on_time_entry_delete AFTER DELETE ON public.time_entries REFERENCING OLD TABLE AS old_time_entries FOR EACH STATEMENT EXECUTE FUNCTION refresh_time_entry_summaries_after_delete();

CREATE TRIGGER update_summary_on_time_entry_insert AFTER INSERT ON public.time_entries REFERENCING NEW TABLE AS new_time_entries FOR EACH STATEMENT EXECUTE FUNCTION refresh_time_entry_summaries_after_insert();

CREATE TRIGGER update_summary_on_time_entry_update AFTER UPDATE ON public.time_entries REFERENCING OLD TABLE AS old_time_entries NEW TABLE AS new_time_entries FOR EACH STATEMENT EXECUTE FUNCTION refresh_time_entry_summaries_after_update();

CREATE TRIGGER employee_work_item_update_guard BEFORE UPDATE ON public.workload_tasks FOR EACH ROW EXECUTE FUNCTION private.enforce_employee_workload_task_update();

CREATE TRIGGER trg_prune_ugc_translations AFTER DELETE ON public.workload_tasks FOR EACH ROW EXECUTE FUNCTION hr_ugc_translations_prune('task');

CREATE TRIGGER trigger_update_workload_tasks_updated_at BEFORE UPDATE ON public.workload_tasks FOR EACH ROW EXECUTE FUNCTION update_workload_tasks_updated_at();

CREATE VIEW public."recruitment_pipeline" WITH (security_invoker = true) AS
 SELECT jp.id AS job_id,
    jp.title AS job_title,
    jp.department,
    jp.status AS job_status,
    count(ja.id) AS total_applications,
    count(*) FILTER (WHERE ja.status::text = 'applied'::text) AS applied,
    count(*) FILTER (WHERE ja.status::text = 'screening'::text) AS screening,
    count(*) FILTER (WHERE ja.status::text = 'interview_scheduled'::text) AS interview_scheduled,
    count(*) FILTER (WHERE ja.status::text = 'technical'::text) AS technical,
    count(*) FILTER (WHERE ja.status::text = 'hr_round'::text) AS hr_round,
    count(*) FILTER (WHERE ja.status::text = 'offer'::text) AS offer,
    count(*) FILTER (WHERE ja.status::text = 'hired'::text) AS hired,
    count(*) FILTER (WHERE ja.status::text = 'rejected'::text) AS rejected
   FROM job_postings jp
     LEFT JOIN job_applications ja ON jp.id = ja.job_posting_id
  GROUP BY jp.id, jp.title, jp.department, jp.status;

GRANT SELECT ON public."recruitment_pipeline" TO authenticated, service_role;

CREATE VIEW public."upcoming_interviews" WITH (security_invoker = true) AS
 SELECT ist.id AS interview_id,
    ist.scheduled_time,
    ist.interview_type,
    ist.duration_minutes,
    ist.location,
    ist.status,
    ja.candidate_name,
    ja.email AS candidate_email,
    ja.phone AS candidate_phone,
    jp.title AS job_title,
    e.name AS interviewer_name,
    e.email AS interviewer_email
   FROM interview_schedules ist
     JOIN job_applications ja ON ist.application_id = ja.id
     JOIN job_postings jp ON ja.job_posting_id = jp.id
     LEFT JOIN employees e ON ist.interviewer_id = e.id
  WHERE ist.status::text = 'scheduled'::text AND ist.scheduled_time >= CURRENT_TIMESTAMP
  ORDER BY ist.scheduled_time;

GRANT SELECT ON public."upcoming_interviews" TO authenticated, service_role;

CREATE VIEW public."user_emails_view" WITH (security_invoker = true) AS
 SELECT ue.id,
    ue.hr_user_id,
    ue.auth_user_id,
    ue.email,
    ue.is_primary,
    hu.full_name,
    hu.role,
    hu.department,
    hu.is_active,
    ue.created_at
   FROM user_emails ue
     JOIN hr_users hu ON ue.hr_user_id = hu.id;

GRANT SELECT ON public."user_emails_view" TO authenticated, service_role;

CREATE VIEW public."goals_with_progress" WITH (security_invoker = true) AS
 SELECT pg.id,
    pg.employee_id,
    pg.title,
    pg.description,
    pg.category,
    pg.target_date,
    pg.status,
    pg.progress_percentage,
    pg.priority,
    pg.assigned_by,
    pg.assigned_date,
    pg.started_date,
    pg.completed_date,
    pg.notes,
    pg.success_criteria,
    pg.related_review_id,
    pg.created_at,
    pg.updated_at,
    e.name AS employee_name,
    e.department,
    e."position",
    count(gm.id) AS total_milestones,
    count(
        CASE
            WHEN gm.status = 'completed'::text THEN gm.id
            ELSE NULL::uuid
        END) AS completed_milestones
   FROM performance_goals pg
     LEFT JOIN employees e ON pg.employee_id = e.id
     LEFT JOIN goal_milestones gm ON pg.id = gm.goal_id
  GROUP BY pg.id, e.name, e.department, e."position";

GRANT SELECT ON public."goals_with_progress" TO authenticated, service_role;

CREATE VIEW public."skills_matrix" WITH (security_invoker = true) AS
 SELECT e.department,
    ps.skill_name,
    ps.skill_category,
    avg(ps.rating) AS avg_rating,
    count(ps.id) AS employee_count,
    max(ps.rating) AS max_rating,
    min(ps.rating) AS min_rating
   FROM performance_skills ps
     JOIN employees e ON ps.employee_id = e.id
  GROUP BY e.department, ps.skill_name, ps.skill_category;

GRANT SELECT ON public."skills_matrix" TO authenticated, service_role;

CREATE VIEW public."notification_stats" WITH (security_invoker = true) AS
 SELECT user_id,
    count(*) AS total_notifications,
    count(*) FILTER (WHERE is_read = false) AS unread_count,
    count(*) FILTER (WHERE type::text = 'error'::text) AS error_count,
    count(*) FILTER (WHERE type::text = 'warning'::text) AS warning_count,
    max(created_at) AS latest_notification_at
   FROM hr_notifications
  WHERE expires_at IS NULL OR expires_at > now()
  GROUP BY user_id;

GRANT SELECT ON public."notification_stats" TO authenticated, service_role;

CREATE VIEW public."proof_file_statistics" WITH (security_invoker = true) AS
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    count(DISTINCT te.proof_file_url) + count(DISTINCT lr.proof_file_url) AS total_files,
    count(DISTINCT te.proof_file_url) AS time_entry_files,
    count(DISTINCT lr.proof_file_url) AS leave_request_files
   FROM employees e
     LEFT JOIN time_entries te ON e.id = te.employee_id AND te.proof_file_url IS NOT NULL
     LEFT JOIN leave_requests lr ON e.id = lr.employee_id AND lr.proof_file_url IS NOT NULL
  GROUP BY e.id, e.name
 HAVING (count(DISTINCT te.proof_file_url) + count(DISTINCT lr.proof_file_url)) > 0
  ORDER BY (count(DISTINCT te.proof_file_url) + count(DISTINCT lr.proof_file_url)) DESC;

GRANT SELECT ON public."proof_file_statistics" TO authenticated, service_role;

CREATE VIEW public."monthly_attendance_summary" WITH (security_invoker = true) AS
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    EXTRACT(year FROM te.date) AS year,
    EXTRACT(month FROM te.date) AS month,
    count(DISTINCT te.date) AS days_worked,
    sum(te.hours) AS total_hours,
    round(avg(te.hours), 2) AS avg_hours_per_day
   FROM employees e
     LEFT JOIN time_entries te ON e.id = te.employee_id AND te.status::text = 'approved'::text
  GROUP BY e.id, e.name, e.department, (EXTRACT(year FROM te.date)), (EXTRACT(month FROM te.date))
  ORDER BY (EXTRACT(year FROM te.date)) DESC, (EXTRACT(month FROM te.date)) DESC, e.name;

GRANT SELECT ON public."monthly_attendance_summary" TO authenticated, service_role;

CREATE VIEW public."employee_performance_summary" WITH (security_invoker = true) AS
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e."position",
    count(pr.id) AS total_reviews,
    round(avg(pr.overall_rating), 2) AS avg_rating,
    round(avg(pr.technical_skills_rating), 2) AS avg_technical_skills,
    round(avg(pr.communication_rating), 2) AS avg_communication,
    round(avg(pr.teamwork_rating), 2) AS avg_teamwork,
    round(avg(pr.leadership_rating), 2) AS avg_leadership,
    round(avg(pr.problem_solving_rating), 2) AS avg_problem_solving,
    round(avg(pr.goals_met::numeric / NULLIF(pr.goals_total, 0)::numeric), 2) AS avg_goal_completion_rate,
    max(pr.review_date) AS last_review_date,
    min(pr.review_date) AS first_review_date,
    count(
        CASE
            WHEN pr.status = 'approved'::text THEN 1
            ELSE NULL::integer
        END) AS approved_reviews,
    count(
        CASE
            WHEN pr.status = 'pending'::text THEN 1
            ELSE NULL::integer
        END) AS pending_reviews
   FROM employees e
     LEFT JOIN performance_reviews pr ON e.id = pr.employee_id
  GROUP BY e.id, e.name, e.department, e."position";

GRANT SELECT ON public."employee_performance_summary" TO authenticated, service_role;

CREATE VIEW public."time_entries_detailed" WITH (security_invoker = true) AS
 SELECT te.id,
    te.employee_id,
    te.date,
    te.clock_in,
    te.clock_out,
    te.hours,
    te.hour_type,
    te.notes,
    te.status,
    te.proof_file_url,
    te.proof_file_name,
    te.proof_file_type,
    te.proof_file_path,
    te.approved_by,
    te.approved_at,
    te.created_at,
    te.updated_at,
    e.name AS employee_name,
    e.email AS employee_email,
    e.department AS employee_department,
    e."position" AS employee_position
   FROM time_entries te
     LEFT JOIN employees e ON te.employee_id = e.id
  ORDER BY te.date DESC, te.created_at DESC;

GRANT SELECT ON public."time_entries_detailed" TO authenticated, service_role;

CREATE VIEW public."applications_detailed" WITH (security_invoker = true) AS
 SELECT ja.id,
    ja.candidate_name,
    ja.email,
    ja.phone,
    ja.experience_years,
    ja.status,
    ja.stage,
    ja.applied_date,
    ja.rating,
    jp.title AS job_title,
    jp.department,
    jp.position_type,
    jp.location,
    count(ist.id) AS interview_count,
    max(ist.scheduled_time) AS last_interview_date
   FROM job_applications ja
     JOIN job_postings jp ON ja.job_posting_id = jp.id
     LEFT JOIN interview_schedules ist ON ja.id = ist.application_id
  GROUP BY ja.id, ja.candidate_name, ja.email, ja.phone, ja.experience_years, ja.status, ja.stage, ja.applied_date, ja.rating, jp.title, jp.department, jp.position_type, jp.location;

GRANT SELECT ON public."applications_detailed" TO authenticated, service_role;

ALTER TABLE public."visits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."hr_users" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."employees" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."applicants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."user_emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."applications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."job_postings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."open_punches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."time_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."overtime_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."goal_check_ins" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."leave_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."workload_tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."goal_milestones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."hr_notifications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."hr_user_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."job_applications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."proof_file_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."employee_feedback" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."performance_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."translation_cache" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."performance_skills" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."skills_assessments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."hr_ugc_translations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."hr_user_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."interview_schedules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."performance_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."recruitment_metrics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."performance_comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."time_tracking_summary" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert performance comments" ON "public"."performance_comments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view performance comments" ON "public"."performance_comments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Admins and managers can delete job postings" ON "public"."job_postings" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT private.current_hr_role() AS current_hr_role) = ANY (ARRAY['admin'::text, 'manager'::text])));

CREATE POLICY "Admins and managers can insert job postings" ON "public"."job_postings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT private.current_hr_role() AS current_hr_role) = ANY (ARRAY['admin'::text, 'manager'::text])));

CREATE POLICY "Admins and managers can update job postings" ON "public"."job_postings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT private.current_hr_role() AS current_hr_role) = ANY (ARRAY['admin'::text, 'manager'::text]))) WITH CHECK ((( SELECT private.current_hr_role() AS current_hr_role) = ANY (ARRAY['admin'::text, 'manager'::text])));

CREATE POLICY "Authenticated users can view job postings" ON "public"."job_postings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "employee_feedback_delete" ON "public"."employee_feedback" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))));

CREATE POLICY "employee_feedback_insert" ON "public"."employee_feedback" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = employee_feedback.feedback_from) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "employee_feedback_select" ON "public"."employee_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = employee_feedback.employee_id) OR (hu.employee_id = employee_feedback.feedback_from) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "employee_feedback_update" ON "public"."employee_feedback" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = employee_feedback.feedback_from) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = employee_feedback.feedback_from) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "Authenticated users can manage job applications" ON "public"."job_applications" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view job applications" ON "public"."job_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "skills_assessments_all" ON "public"."skills_assessments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = skills_assessments.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = skills_assessments.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "hr_users_admin_delete" ON "public"."hr_users" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "hr_users_manager_insert" ON "public"."hr_users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "hr_users_scoped_select" ON "public"."hr_users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.is_active_hr_user() AND ((id = private.current_hr_user_id()) OR private.can_manage_employee(employee_id))));

CREATE POLICY "hr_users_scoped_update" ON "public"."hr_users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((private.is_active_hr_user() AND ((id = private.current_hr_user_id()) OR private.can_manage_employee(employee_id)))) WITH CHECK ((private.is_active_hr_user() AND ((id = private.current_hr_user_id()) OR private.can_manage_employee(employee_id))));

CREATE POLICY "Authenticated users can delete employee documents" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((bucket_id = 'employee-documents'::text));

CREATE POLICY "Authenticated users can update employee documents" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((bucket_id = 'employee-documents'::text));

CREATE POLICY "Authenticated users can upload employee documents" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((bucket_id = 'employee-documents'::text));

CREATE POLICY "Authenticated users can view employee documents" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((bucket_id = 'employee-documents'::text));

CREATE POLICY "Public read access for employee-documents" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "public" USING ((bucket_id = 'employee-documents'::text));

CREATE POLICY "leave_requests_scoped_delete" ON "public"."leave_requests" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "leave_requests_scoped_insert" ON "public"."leave_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "leave_requests_scoped_select" ON "public"."leave_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "leave_requests_scoped_update" ON "public"."leave_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "Authenticated users can manage interview schedules" ON "public"."interview_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view interview schedules" ON "public"."interview_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "overtime_logs_scoped_delete" ON "public"."overtime_logs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "overtime_logs_scoped_insert" ON "public"."overtime_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "overtime_logs_scoped_select" ON "public"."overtime_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "overtime_logs_scoped_update" ON "public"."overtime_logs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "Allow all to read summary" ON "public"."time_tracking_summary" AS PERMISSIVE FOR SELECT TO "public" USING (true);

CREATE POLICY "Allow authenticated to insert summary" ON "public"."time_tracking_summary" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow authenticated to update summary" ON "public"."time_tracking_summary" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true);

CREATE POLICY "compat_authenticated_delete" ON "public"."time_tracking_summary" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);

CREATE POLICY "Anyone can insert applicants" ON "public"."applicants" AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK (true);

CREATE POLICY "Authenticated users can update applicants" ON "public"."applicants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view applicants" ON "public"."applicants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "user_emails_admin_manage" ON "public"."user_emails" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_hr_role() = 'admin'::text)) WITH CHECK ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "user_emails_own_select" ON "public"."user_emails" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.is_active_hr_user() AND ((auth_user_id = ( SELECT auth.uid() AS uid)) OR (hr_user_id = private.current_hr_user_id()) OR (private.current_hr_role() = 'admin'::text))));

CREATE POLICY "compat_authenticated_all" ON "public"."proof_file_audit" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete applications" ON "public"."applications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (true);

CREATE POLICY "Authenticated users can insert applications" ON "public"."applications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Authenticated users can update applications" ON "public"."applications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view applications" ON "public"."applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated users can view recruitment metrics" ON "public"."recruitment_metrics" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "hr_user_permissions_admin_manage" ON "public"."hr_user_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((private.current_hr_role() = 'admin'::text)) WITH CHECK ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "hr_user_permissions_own_select" ON "public"."hr_user_permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id()) AND (revoked_at IS NULL)));

CREATE POLICY "Allow admins to read visits" ON "public"."visits" AS PERMISSIVE FOR SELECT TO "public" USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "compat_authenticated_write" ON "public"."visits" AS PERMISSIVE FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "performance_skills_all" ON "public"."performance_skills" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_skills.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_skills.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "performance_reviews_delete" ON "public"."performance_reviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.role)::text = 'admin'::text)))));

CREATE POLICY "performance_reviews_insert" ON "public"."performance_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_reviews.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "performance_reviews_select" ON "public"."performance_reviews" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_reviews.employee_id) OR (hu.employee_id = performance_reviews.reviewer_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "performance_reviews_update" ON "public"."performance_reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_reviews.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM hr_users hu
  WHERE ((hu.id = ( SELECT auth.uid() AS uid)) AND ((hu.employee_id = performance_reviews.employee_id) OR ((hu.role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::text[])))))));

CREATE POLICY "performance_goals_manager_delete" ON "public"."performance_goals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.can_manage_employee(employee_id));

CREATE POLICY "performance_goals_scoped_insert" ON "public"."performance_goals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.can_manage_employee(employee_id));

CREATE POLICY "performance_goals_scoped_select" ON "public"."performance_goals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR (assigned_by = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "performance_goals_scoped_update" ON "public"."performance_goals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "goal_milestones_manager_delete" ON "public"."goal_milestones" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_milestones.goal_id) AND private.can_manage_employee(pg.employee_id)))));

CREATE POLICY "goal_milestones_scoped_insert" ON "public"."goal_milestones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_milestones.goal_id) AND ((pg.employee_id = private.current_employee_id()) OR private.can_manage_employee(pg.employee_id))))));

CREATE POLICY "goal_milestones_scoped_select" ON "public"."goal_milestones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_milestones.goal_id) AND ((pg.employee_id = private.current_employee_id()) OR (pg.assigned_by = private.current_employee_id()) OR private.can_manage_employee(pg.employee_id))))));

CREATE POLICY "goal_milestones_scoped_update" ON "public"."goal_milestones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_milestones.goal_id) AND ((pg.employee_id = private.current_employee_id()) OR private.can_manage_employee(pg.employee_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_milestones.goal_id) AND ((pg.employee_id = private.current_employee_id()) OR private.can_manage_employee(pg.employee_id))))));

CREATE POLICY "goal_check_ins_insert" ON "public"."goal_check_ins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((author_auth_id = ( SELECT auth.uid() AS uid)) AND (employee_id = private.current_employee_id()) AND (EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_check_ins.goal_id) AND (pg.employee_id = private.current_employee_id()))))));

CREATE POLICY "goal_check_ins_owner_delete" ON "public"."goal_check_ins" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((author_auth_id = ( SELECT auth.uid() AS uid)) AND private.is_active_hr_user()));

CREATE POLICY "goal_check_ins_owner_update" ON "public"."goal_check_ins" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((author_auth_id = ( SELECT auth.uid() AS uid)) AND private.is_active_hr_user())) WITH CHECK (((author_auth_id = ( SELECT auth.uid() AS uid)) AND (employee_id = private.current_employee_id()) AND (EXISTS ( SELECT 1
   FROM performance_goals pg
  WHERE ((pg.id = goal_check_ins.goal_id) AND (pg.employee_id = private.current_employee_id()))))));

CREATE POLICY "goal_check_ins_select" ON "public"."goal_check_ins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "hr_ugc_translations_delete" ON "public"."hr_ugc_translations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (hr_can_translate(entity_type, entity_id));

CREATE POLICY "hr_ugc_translations_insert" ON "public"."hr_ugc_translations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (hr_can_translate(entity_type, entity_id));

CREATE POLICY "hr_ugc_translations_select" ON "public"."hr_ugc_translations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "hr_ugc_translations_update" ON "public"."hr_ugc_translations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (hr_can_translate(entity_type, entity_id)) WITH CHECK (hr_can_translate(entity_type, entity_id));

CREATE POLICY "workload_tasks_manager_delete" ON "public"."workload_tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((created_by = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "workload_tasks_scoped_insert" ON "public"."workload_tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.can_manage_employee(employee_id));

CREATE POLICY "workload_tasks_scoped_select" ON "public"."workload_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR (created_by = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "workload_tasks_scoped_update" ON "public"."workload_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "employees_admin_delete" ON "public"."employees" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "employees_manager_insert" ON "public"."employees" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((private.current_hr_role() = 'admin'::text));

CREATE POLICY "employees_manager_update" ON "public"."employees" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.can_manage_employee(id)) WITH CHECK (private.can_manage_employee(id));

CREATE POLICY "employees_scoped_select" ON "public"."employees" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((id = private.current_employee_id()) OR private.can_manage_employee(id)));

CREATE POLICY "time_entries_scoped_delete" ON "public"."time_entries" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "time_entries_scoped_insert" ON "public"."time_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "time_entries_scoped_select" ON "public"."time_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "time_entries_scoped_update" ON "public"."time_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "hr_notifications_owner_delete" ON "public"."hr_notifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_notifications_owner_select" ON "public"."hr_notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_notifications_owner_update" ON "public"."hr_notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id()))) WITH CHECK ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_notifications_scoped_insert" ON "public"."hr_notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((private.is_active_hr_user() AND ((user_id = private.current_hr_user_id()) OR private.can_manage_employee(( SELECT hu.employee_id
   FROM hr_users hu
  WHERE (hu.id = hr_notifications.user_id))))));

CREATE POLICY "hr_user_settings_owner_delete" ON "public"."hr_user_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_user_settings_owner_insert" ON "public"."hr_user_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_user_settings_owner_select" ON "public"."hr_user_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "hr_user_settings_owner_update" ON "public"."hr_user_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id()))) WITH CHECK ((private.is_active_hr_user() AND (user_id = private.current_hr_user_id())));

CREATE POLICY "open_punches_scoped_delete" ON "public"."open_punches" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "open_punches_scoped_insert" ON "public"."open_punches" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "open_punches_scoped_select" ON "public"."open_punches" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

CREATE POLICY "open_punches_scoped_update" ON "public"."open_punches" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id))) WITH CHECK (((employee_id = private.current_employee_id()) OR private.can_manage_employee(employee_id)));

GRANT INSERT ON public."performance_comments" TO "anon";

GRANT SELECT ON public."performance_comments" TO "anon";

GRANT UPDATE ON public."performance_comments" TO "anon";

GRANT DELETE ON public."performance_comments" TO "anon";

GRANT TRUNCATE ON public."performance_comments" TO "anon";

GRANT REFERENCES ON public."performance_comments" TO "anon";

GRANT TRIGGER ON public."performance_comments" TO "anon";

GRANT INSERT ON public."performance_comments" TO "authenticated";

GRANT SELECT ON public."performance_comments" TO "authenticated";

GRANT UPDATE ON public."performance_comments" TO "authenticated";

GRANT DELETE ON public."performance_comments" TO "authenticated";

GRANT TRUNCATE ON public."performance_comments" TO "authenticated";

GRANT REFERENCES ON public."performance_comments" TO "authenticated";

GRANT TRIGGER ON public."performance_comments" TO "authenticated";

GRANT INSERT ON public."performance_comments" TO "service_role";

GRANT SELECT ON public."performance_comments" TO "service_role";

GRANT UPDATE ON public."performance_comments" TO "service_role";

GRANT DELETE ON public."performance_comments" TO "service_role";

GRANT TRUNCATE ON public."performance_comments" TO "service_role";

GRANT REFERENCES ON public."performance_comments" TO "service_role";

GRANT TRIGGER ON public."performance_comments" TO "service_role";

GRANT INSERT ON public."translation_cache" TO "anon";

GRANT SELECT ON public."translation_cache" TO "anon";

GRANT UPDATE ON public."translation_cache" TO "anon";

GRANT DELETE ON public."translation_cache" TO "anon";

GRANT TRUNCATE ON public."translation_cache" TO "anon";

GRANT REFERENCES ON public."translation_cache" TO "anon";

GRANT TRIGGER ON public."translation_cache" TO "anon";

GRANT INSERT ON public."translation_cache" TO "authenticated";

GRANT SELECT ON public."translation_cache" TO "authenticated";

GRANT UPDATE ON public."translation_cache" TO "authenticated";

GRANT DELETE ON public."translation_cache" TO "authenticated";

GRANT TRUNCATE ON public."translation_cache" TO "authenticated";

GRANT REFERENCES ON public."translation_cache" TO "authenticated";

GRANT TRIGGER ON public."translation_cache" TO "authenticated";

GRANT INSERT ON public."translation_cache" TO "service_role";

GRANT SELECT ON public."translation_cache" TO "service_role";

GRANT UPDATE ON public."translation_cache" TO "service_role";

GRANT DELETE ON public."translation_cache" TO "service_role";

GRANT TRUNCATE ON public."translation_cache" TO "service_role";

GRANT REFERENCES ON public."translation_cache" TO "service_role";

GRANT TRIGGER ON public."translation_cache" TO "service_role";

GRANT INSERT ON public."job_postings" TO "anon";

GRANT SELECT ON public."job_postings" TO "anon";

GRANT UPDATE ON public."job_postings" TO "anon";

GRANT DELETE ON public."job_postings" TO "anon";

GRANT TRUNCATE ON public."job_postings" TO "anon";

GRANT REFERENCES ON public."job_postings" TO "anon";

GRANT TRIGGER ON public."job_postings" TO "anon";

GRANT INSERT ON public."job_postings" TO "authenticated";

GRANT SELECT ON public."job_postings" TO "authenticated";

GRANT UPDATE ON public."job_postings" TO "authenticated";

GRANT DELETE ON public."job_postings" TO "authenticated";

GRANT TRUNCATE ON public."job_postings" TO "authenticated";

GRANT REFERENCES ON public."job_postings" TO "authenticated";

GRANT TRIGGER ON public."job_postings" TO "authenticated";

GRANT INSERT ON public."job_postings" TO "service_role";

GRANT SELECT ON public."job_postings" TO "service_role";

GRANT UPDATE ON public."job_postings" TO "service_role";

GRANT DELETE ON public."job_postings" TO "service_role";

GRANT TRUNCATE ON public."job_postings" TO "service_role";

GRANT REFERENCES ON public."job_postings" TO "service_role";

GRANT TRIGGER ON public."job_postings" TO "service_role";

GRANT INSERT ON public."employee_feedback" TO "anon";

GRANT SELECT ON public."employee_feedback" TO "anon";

GRANT UPDATE ON public."employee_feedback" TO "anon";

GRANT DELETE ON public."employee_feedback" TO "anon";

GRANT TRUNCATE ON public."employee_feedback" TO "anon";

GRANT REFERENCES ON public."employee_feedback" TO "anon";

GRANT TRIGGER ON public."employee_feedback" TO "anon";

GRANT INSERT ON public."employee_feedback" TO "authenticated";

GRANT SELECT ON public."employee_feedback" TO "authenticated";

GRANT UPDATE ON public."employee_feedback" TO "authenticated";

GRANT DELETE ON public."employee_feedback" TO "authenticated";

GRANT TRUNCATE ON public."employee_feedback" TO "authenticated";

GRANT REFERENCES ON public."employee_feedback" TO "authenticated";

GRANT TRIGGER ON public."employee_feedback" TO "authenticated";

GRANT INSERT ON public."employee_feedback" TO "service_role";

GRANT SELECT ON public."employee_feedback" TO "service_role";

GRANT UPDATE ON public."employee_feedback" TO "service_role";

GRANT DELETE ON public."employee_feedback" TO "service_role";

GRANT TRUNCATE ON public."employee_feedback" TO "service_role";

GRANT REFERENCES ON public."employee_feedback" TO "service_role";

GRANT TRIGGER ON public."employee_feedback" TO "service_role";

GRANT INSERT ON public."job_applications" TO "anon";

GRANT SELECT ON public."job_applications" TO "anon";

GRANT UPDATE ON public."job_applications" TO "anon";

GRANT DELETE ON public."job_applications" TO "anon";

GRANT TRUNCATE ON public."job_applications" TO "anon";

GRANT REFERENCES ON public."job_applications" TO "anon";

GRANT TRIGGER ON public."job_applications" TO "anon";

GRANT INSERT ON public."job_applications" TO "authenticated";

GRANT SELECT ON public."job_applications" TO "authenticated";

GRANT UPDATE ON public."job_applications" TO "authenticated";

GRANT DELETE ON public."job_applications" TO "authenticated";

GRANT TRUNCATE ON public."job_applications" TO "authenticated";

GRANT REFERENCES ON public."job_applications" TO "authenticated";

GRANT TRIGGER ON public."job_applications" TO "authenticated";

GRANT INSERT ON public."job_applications" TO "service_role";

GRANT SELECT ON public."job_applications" TO "service_role";

GRANT UPDATE ON public."job_applications" TO "service_role";

GRANT DELETE ON public."job_applications" TO "service_role";

GRANT TRUNCATE ON public."job_applications" TO "service_role";

GRANT REFERENCES ON public."job_applications" TO "service_role";

GRANT TRIGGER ON public."job_applications" TO "service_role";

GRANT INSERT ON public."skills_assessments" TO "anon";

GRANT SELECT ON public."skills_assessments" TO "anon";

GRANT UPDATE ON public."skills_assessments" TO "anon";

GRANT DELETE ON public."skills_assessments" TO "anon";

GRANT TRUNCATE ON public."skills_assessments" TO "anon";

GRANT REFERENCES ON public."skills_assessments" TO "anon";

GRANT TRIGGER ON public."skills_assessments" TO "anon";

GRANT INSERT ON public."skills_assessments" TO "authenticated";

GRANT SELECT ON public."skills_assessments" TO "authenticated";

GRANT UPDATE ON public."skills_assessments" TO "authenticated";

GRANT DELETE ON public."skills_assessments" TO "authenticated";

GRANT TRUNCATE ON public."skills_assessments" TO "authenticated";

GRANT REFERENCES ON public."skills_assessments" TO "authenticated";

GRANT TRIGGER ON public."skills_assessments" TO "authenticated";

GRANT INSERT ON public."skills_assessments" TO "service_role";

GRANT SELECT ON public."skills_assessments" TO "service_role";

GRANT UPDATE ON public."skills_assessments" TO "service_role";

GRANT DELETE ON public."skills_assessments" TO "service_role";

GRANT TRUNCATE ON public."skills_assessments" TO "service_role";

GRANT REFERENCES ON public."skills_assessments" TO "service_role";

GRANT TRIGGER ON public."skills_assessments" TO "service_role";

GRANT INSERT ON public."hr_users" TO "authenticated";

GRANT SELECT ON public."hr_users" TO "authenticated";

GRANT UPDATE ON public."hr_users" TO "authenticated";

GRANT DELETE ON public."hr_users" TO "authenticated";

GRANT TRUNCATE ON public."hr_users" TO "authenticated";

GRANT REFERENCES ON public."hr_users" TO "authenticated";

GRANT TRIGGER ON public."hr_users" TO "authenticated";

GRANT INSERT ON public."hr_users" TO "service_role";

GRANT SELECT ON public."hr_users" TO "service_role";

GRANT UPDATE ON public."hr_users" TO "service_role";

GRANT DELETE ON public."hr_users" TO "service_role";

GRANT TRUNCATE ON public."hr_users" TO "service_role";

GRANT REFERENCES ON public."hr_users" TO "service_role";

GRANT TRIGGER ON public."hr_users" TO "service_role";

GRANT INSERT ON public."interview_schedules" TO "anon";

GRANT SELECT ON public."interview_schedules" TO "anon";

GRANT UPDATE ON public."interview_schedules" TO "anon";

GRANT DELETE ON public."interview_schedules" TO "anon";

GRANT TRUNCATE ON public."interview_schedules" TO "anon";

GRANT REFERENCES ON public."interview_schedules" TO "anon";

GRANT TRIGGER ON public."interview_schedules" TO "anon";

GRANT INSERT ON public."interview_schedules" TO "authenticated";

GRANT SELECT ON public."interview_schedules" TO "authenticated";

GRANT UPDATE ON public."interview_schedules" TO "authenticated";

GRANT DELETE ON public."interview_schedules" TO "authenticated";

GRANT TRUNCATE ON public."interview_schedules" TO "authenticated";

GRANT REFERENCES ON public."interview_schedules" TO "authenticated";

GRANT TRIGGER ON public."interview_schedules" TO "authenticated";

GRANT INSERT ON public."interview_schedules" TO "service_role";

GRANT SELECT ON public."interview_schedules" TO "service_role";

GRANT UPDATE ON public."interview_schedules" TO "service_role";

GRANT DELETE ON public."interview_schedules" TO "service_role";

GRANT TRUNCATE ON public."interview_schedules" TO "service_role";

GRANT REFERENCES ON public."interview_schedules" TO "service_role";

GRANT TRIGGER ON public."interview_schedules" TO "service_role";

GRANT INSERT ON public."leave_requests" TO "authenticated";

GRANT SELECT ON public."leave_requests" TO "authenticated";

GRANT UPDATE ON public."leave_requests" TO "authenticated";

GRANT DELETE ON public."leave_requests" TO "authenticated";

GRANT TRUNCATE ON public."leave_requests" TO "authenticated";

GRANT REFERENCES ON public."leave_requests" TO "authenticated";

GRANT TRIGGER ON public."leave_requests" TO "authenticated";

GRANT INSERT ON public."leave_requests" TO "service_role";

GRANT SELECT ON public."leave_requests" TO "service_role";

GRANT UPDATE ON public."leave_requests" TO "service_role";

GRANT DELETE ON public."leave_requests" TO "service_role";

GRANT TRUNCATE ON public."leave_requests" TO "service_role";

GRANT REFERENCES ON public."leave_requests" TO "service_role";

GRANT TRIGGER ON public."leave_requests" TO "service_role";

GRANT INSERT ON public."overtime_logs" TO "authenticated";

GRANT SELECT ON public."overtime_logs" TO "authenticated";

GRANT UPDATE ON public."overtime_logs" TO "authenticated";

GRANT DELETE ON public."overtime_logs" TO "authenticated";

GRANT TRUNCATE ON public."overtime_logs" TO "authenticated";

GRANT REFERENCES ON public."overtime_logs" TO "authenticated";

GRANT TRIGGER ON public."overtime_logs" TO "authenticated";

GRANT INSERT ON public."overtime_logs" TO "service_role";

GRANT SELECT ON public."overtime_logs" TO "service_role";

GRANT UPDATE ON public."overtime_logs" TO "service_role";

GRANT DELETE ON public."overtime_logs" TO "service_role";

GRANT TRUNCATE ON public."overtime_logs" TO "service_role";

GRANT REFERENCES ON public."overtime_logs" TO "service_role";

GRANT TRIGGER ON public."overtime_logs" TO "service_role";

GRANT INSERT ON public."user_emails" TO "authenticated";

GRANT SELECT ON public."user_emails" TO "authenticated";

GRANT UPDATE ON public."user_emails" TO "authenticated";

GRANT DELETE ON public."user_emails" TO "authenticated";

GRANT TRUNCATE ON public."user_emails" TO "authenticated";

GRANT REFERENCES ON public."user_emails" TO "authenticated";

GRANT TRIGGER ON public."user_emails" TO "authenticated";

GRANT INSERT ON public."user_emails" TO "service_role";

GRANT SELECT ON public."user_emails" TO "service_role";

GRANT UPDATE ON public."user_emails" TO "service_role";

GRANT DELETE ON public."user_emails" TO "service_role";

GRANT TRUNCATE ON public."user_emails" TO "service_role";

GRANT REFERENCES ON public."user_emails" TO "service_role";

GRANT TRIGGER ON public."user_emails" TO "service_role";

GRANT INSERT ON public."time_tracking_summary" TO "anon";

GRANT SELECT ON public."time_tracking_summary" TO "anon";

GRANT UPDATE ON public."time_tracking_summary" TO "anon";

GRANT DELETE ON public."time_tracking_summary" TO "anon";

GRANT TRUNCATE ON public."time_tracking_summary" TO "anon";

GRANT REFERENCES ON public."time_tracking_summary" TO "anon";

GRANT TRIGGER ON public."time_tracking_summary" TO "anon";

GRANT INSERT ON public."time_tracking_summary" TO "authenticated";

GRANT SELECT ON public."time_tracking_summary" TO "authenticated";

GRANT UPDATE ON public."time_tracking_summary" TO "authenticated";

GRANT DELETE ON public."time_tracking_summary" TO "authenticated";

GRANT TRUNCATE ON public."time_tracking_summary" TO "authenticated";

GRANT REFERENCES ON public."time_tracking_summary" TO "authenticated";

GRANT TRIGGER ON public."time_tracking_summary" TO "authenticated";

GRANT INSERT ON public."time_tracking_summary" TO "service_role";

GRANT SELECT ON public."time_tracking_summary" TO "service_role";

GRANT UPDATE ON public."time_tracking_summary" TO "service_role";

GRANT DELETE ON public."time_tracking_summary" TO "service_role";

GRANT TRUNCATE ON public."time_tracking_summary" TO "service_role";

GRANT REFERENCES ON public."time_tracking_summary" TO "service_role";

GRANT TRIGGER ON public."time_tracking_summary" TO "service_role";

GRANT INSERT ON public."applicants" TO "anon";

GRANT SELECT ON public."applicants" TO "anon";

GRANT UPDATE ON public."applicants" TO "anon";

GRANT DELETE ON public."applicants" TO "anon";

GRANT TRUNCATE ON public."applicants" TO "anon";

GRANT REFERENCES ON public."applicants" TO "anon";

GRANT TRIGGER ON public."applicants" TO "anon";

GRANT INSERT ON public."applicants" TO "authenticated";

GRANT SELECT ON public."applicants" TO "authenticated";

GRANT UPDATE ON public."applicants" TO "authenticated";

GRANT DELETE ON public."applicants" TO "authenticated";

GRANT TRUNCATE ON public."applicants" TO "authenticated";

GRANT REFERENCES ON public."applicants" TO "authenticated";

GRANT TRIGGER ON public."applicants" TO "authenticated";

GRANT INSERT ON public."applicants" TO "service_role";

GRANT SELECT ON public."applicants" TO "service_role";

GRANT UPDATE ON public."applicants" TO "service_role";

GRANT DELETE ON public."applicants" TO "service_role";

GRANT TRUNCATE ON public."applicants" TO "service_role";

GRANT REFERENCES ON public."applicants" TO "service_role";

GRANT TRIGGER ON public."applicants" TO "service_role";

GRANT INSERT ON public."applications" TO "anon";

GRANT SELECT ON public."applications" TO "anon";

GRANT UPDATE ON public."applications" TO "anon";

GRANT DELETE ON public."applications" TO "anon";

GRANT TRUNCATE ON public."applications" TO "anon";

GRANT REFERENCES ON public."applications" TO "anon";

GRANT TRIGGER ON public."applications" TO "anon";

GRANT INSERT ON public."applications" TO "authenticated";

GRANT SELECT ON public."applications" TO "authenticated";

GRANT UPDATE ON public."applications" TO "authenticated";

GRANT DELETE ON public."applications" TO "authenticated";

GRANT TRUNCATE ON public."applications" TO "authenticated";

GRANT REFERENCES ON public."applications" TO "authenticated";

GRANT TRIGGER ON public."applications" TO "authenticated";

GRANT INSERT ON public."applications" TO "service_role";

GRANT SELECT ON public."applications" TO "service_role";

GRANT UPDATE ON public."applications" TO "service_role";

GRANT DELETE ON public."applications" TO "service_role";

GRANT TRUNCATE ON public."applications" TO "service_role";

GRANT REFERENCES ON public."applications" TO "service_role";

GRANT TRIGGER ON public."applications" TO "service_role";

GRANT INSERT ON public."recruitment_metrics" TO "anon";

GRANT SELECT ON public."recruitment_metrics" TO "anon";

GRANT UPDATE ON public."recruitment_metrics" TO "anon";

GRANT DELETE ON public."recruitment_metrics" TO "anon";

GRANT TRUNCATE ON public."recruitment_metrics" TO "anon";

GRANT REFERENCES ON public."recruitment_metrics" TO "anon";

GRANT TRIGGER ON public."recruitment_metrics" TO "anon";

GRANT INSERT ON public."recruitment_metrics" TO "authenticated";

GRANT SELECT ON public."recruitment_metrics" TO "authenticated";

GRANT UPDATE ON public."recruitment_metrics" TO "authenticated";

GRANT DELETE ON public."recruitment_metrics" TO "authenticated";

GRANT TRUNCATE ON public."recruitment_metrics" TO "authenticated";

GRANT REFERENCES ON public."recruitment_metrics" TO "authenticated";

GRANT TRIGGER ON public."recruitment_metrics" TO "authenticated";

GRANT INSERT ON public."recruitment_metrics" TO "service_role";

GRANT SELECT ON public."recruitment_metrics" TO "service_role";

GRANT UPDATE ON public."recruitment_metrics" TO "service_role";

GRANT DELETE ON public."recruitment_metrics" TO "service_role";

GRANT TRUNCATE ON public."recruitment_metrics" TO "service_role";

GRANT REFERENCES ON public."recruitment_metrics" TO "service_role";

GRANT TRIGGER ON public."recruitment_metrics" TO "service_role";

GRANT INSERT ON public."proof_file_audit" TO "anon";

GRANT SELECT ON public."proof_file_audit" TO "anon";

GRANT UPDATE ON public."proof_file_audit" TO "anon";

GRANT DELETE ON public."proof_file_audit" TO "anon";

GRANT TRUNCATE ON public."proof_file_audit" TO "anon";

GRANT REFERENCES ON public."proof_file_audit" TO "anon";

GRANT TRIGGER ON public."proof_file_audit" TO "anon";

GRANT INSERT ON public."proof_file_audit" TO "authenticated";

GRANT SELECT ON public."proof_file_audit" TO "authenticated";

GRANT UPDATE ON public."proof_file_audit" TO "authenticated";

GRANT DELETE ON public."proof_file_audit" TO "authenticated";

GRANT TRUNCATE ON public."proof_file_audit" TO "authenticated";

GRANT REFERENCES ON public."proof_file_audit" TO "authenticated";

GRANT TRIGGER ON public."proof_file_audit" TO "authenticated";

GRANT INSERT ON public."proof_file_audit" TO "service_role";

GRANT SELECT ON public."proof_file_audit" TO "service_role";

GRANT UPDATE ON public."proof_file_audit" TO "service_role";

GRANT DELETE ON public."proof_file_audit" TO "service_role";

GRANT TRUNCATE ON public."proof_file_audit" TO "service_role";

GRANT REFERENCES ON public."proof_file_audit" TO "service_role";

GRANT TRIGGER ON public."proof_file_audit" TO "service_role";

GRANT INSERT ON public."hr_user_permissions" TO "authenticated";

GRANT SELECT ON public."hr_user_permissions" TO "authenticated";

GRANT UPDATE ON public."hr_user_permissions" TO "authenticated";

GRANT DELETE ON public."hr_user_permissions" TO "authenticated";

GRANT TRUNCATE ON public."hr_user_permissions" TO "authenticated";

GRANT REFERENCES ON public."hr_user_permissions" TO "authenticated";

GRANT TRIGGER ON public."hr_user_permissions" TO "authenticated";

GRANT INSERT ON public."hr_user_permissions" TO "service_role";

GRANT SELECT ON public."hr_user_permissions" TO "service_role";

GRANT UPDATE ON public."hr_user_permissions" TO "service_role";

GRANT DELETE ON public."hr_user_permissions" TO "service_role";

GRANT TRUNCATE ON public."hr_user_permissions" TO "service_role";

GRANT REFERENCES ON public."hr_user_permissions" TO "service_role";

GRANT TRIGGER ON public."hr_user_permissions" TO "service_role";

GRANT INSERT ON public."visits" TO "anon";

GRANT SELECT ON public."visits" TO "anon";

GRANT UPDATE ON public."visits" TO "anon";

GRANT DELETE ON public."visits" TO "anon";

GRANT TRUNCATE ON public."visits" TO "anon";

GRANT REFERENCES ON public."visits" TO "anon";

GRANT TRIGGER ON public."visits" TO "anon";

GRANT INSERT ON public."visits" TO "authenticated";

GRANT SELECT ON public."visits" TO "authenticated";

GRANT UPDATE ON public."visits" TO "authenticated";

GRANT DELETE ON public."visits" TO "authenticated";

GRANT TRUNCATE ON public."visits" TO "authenticated";

GRANT REFERENCES ON public."visits" TO "authenticated";

GRANT TRIGGER ON public."visits" TO "authenticated";

GRANT INSERT ON public."visits" TO "service_role";

GRANT SELECT ON public."visits" TO "service_role";

GRANT UPDATE ON public."visits" TO "service_role";

GRANT DELETE ON public."visits" TO "service_role";

GRANT TRUNCATE ON public."visits" TO "service_role";

GRANT REFERENCES ON public."visits" TO "service_role";

GRANT TRIGGER ON public."visits" TO "service_role";

GRANT INSERT ON public."performance_goals" TO "authenticated";

GRANT SELECT ON public."performance_goals" TO "authenticated";

GRANT UPDATE ON public."performance_goals" TO "authenticated";

GRANT DELETE ON public."performance_goals" TO "authenticated";

GRANT TRUNCATE ON public."performance_goals" TO "authenticated";

GRANT REFERENCES ON public."performance_goals" TO "authenticated";

GRANT TRIGGER ON public."performance_goals" TO "authenticated";

GRANT INSERT ON public."performance_goals" TO "service_role";

GRANT SELECT ON public."performance_goals" TO "service_role";

GRANT UPDATE ON public."performance_goals" TO "service_role";

GRANT DELETE ON public."performance_goals" TO "service_role";

GRANT TRUNCATE ON public."performance_goals" TO "service_role";

GRANT REFERENCES ON public."performance_goals" TO "service_role";

GRANT TRIGGER ON public."performance_goals" TO "service_role";

GRANT INSERT ON public."performance_reviews" TO "anon";

GRANT SELECT ON public."performance_reviews" TO "anon";

GRANT UPDATE ON public."performance_reviews" TO "anon";

GRANT DELETE ON public."performance_reviews" TO "anon";

GRANT TRUNCATE ON public."performance_reviews" TO "anon";

GRANT REFERENCES ON public."performance_reviews" TO "anon";

GRANT TRIGGER ON public."performance_reviews" TO "anon";

GRANT INSERT ON public."performance_reviews" TO "authenticated";

GRANT SELECT ON public."performance_reviews" TO "authenticated";

GRANT UPDATE ON public."performance_reviews" TO "authenticated";

GRANT DELETE ON public."performance_reviews" TO "authenticated";

GRANT TRUNCATE ON public."performance_reviews" TO "authenticated";

GRANT REFERENCES ON public."performance_reviews" TO "authenticated";

GRANT TRIGGER ON public."performance_reviews" TO "authenticated";

GRANT INSERT ON public."performance_reviews" TO "service_role";

GRANT SELECT ON public."performance_reviews" TO "service_role";

GRANT UPDATE ON public."performance_reviews" TO "service_role";

GRANT DELETE ON public."performance_reviews" TO "service_role";

GRANT TRUNCATE ON public."performance_reviews" TO "service_role";

GRANT REFERENCES ON public."performance_reviews" TO "service_role";

GRANT TRIGGER ON public."performance_reviews" TO "service_role";

GRANT INSERT ON public."performance_skills" TO "anon";

GRANT SELECT ON public."performance_skills" TO "anon";

GRANT UPDATE ON public."performance_skills" TO "anon";

GRANT DELETE ON public."performance_skills" TO "anon";

GRANT TRUNCATE ON public."performance_skills" TO "anon";

GRANT REFERENCES ON public."performance_skills" TO "anon";

GRANT TRIGGER ON public."performance_skills" TO "anon";

GRANT INSERT ON public."performance_skills" TO "authenticated";

GRANT SELECT ON public."performance_skills" TO "authenticated";

GRANT UPDATE ON public."performance_skills" TO "authenticated";

GRANT DELETE ON public."performance_skills" TO "authenticated";

GRANT TRUNCATE ON public."performance_skills" TO "authenticated";

GRANT REFERENCES ON public."performance_skills" TO "authenticated";

GRANT TRIGGER ON public."performance_skills" TO "authenticated";

GRANT INSERT ON public."performance_skills" TO "service_role";

GRANT SELECT ON public."performance_skills" TO "service_role";

GRANT UPDATE ON public."performance_skills" TO "service_role";

GRANT DELETE ON public."performance_skills" TO "service_role";

GRANT TRUNCATE ON public."performance_skills" TO "service_role";

GRANT REFERENCES ON public."performance_skills" TO "service_role";

GRANT TRIGGER ON public."performance_skills" TO "service_role";

GRANT INSERT ON public."goal_milestones" TO "authenticated";

GRANT SELECT ON public."goal_milestones" TO "authenticated";

GRANT UPDATE ON public."goal_milestones" TO "authenticated";

GRANT DELETE ON public."goal_milestones" TO "authenticated";

GRANT TRUNCATE ON public."goal_milestones" TO "authenticated";

GRANT REFERENCES ON public."goal_milestones" TO "authenticated";

GRANT TRIGGER ON public."goal_milestones" TO "authenticated";

GRANT INSERT ON public."goal_milestones" TO "service_role";

GRANT SELECT ON public."goal_milestones" TO "service_role";

GRANT UPDATE ON public."goal_milestones" TO "service_role";

GRANT DELETE ON public."goal_milestones" TO "service_role";

GRANT TRUNCATE ON public."goal_milestones" TO "service_role";

GRANT REFERENCES ON public."goal_milestones" TO "service_role";

GRANT TRIGGER ON public."goal_milestones" TO "service_role";

GRANT INSERT ON public."goal_check_ins" TO "authenticated";

GRANT SELECT ON public."goal_check_ins" TO "authenticated";

GRANT UPDATE ON public."goal_check_ins" TO "authenticated";

GRANT DELETE ON public."goal_check_ins" TO "authenticated";

GRANT TRUNCATE ON public."goal_check_ins" TO "authenticated";

GRANT REFERENCES ON public."goal_check_ins" TO "authenticated";

GRANT TRIGGER ON public."goal_check_ins" TO "authenticated";

GRANT INSERT ON public."goal_check_ins" TO "service_role";

GRANT SELECT ON public."goal_check_ins" TO "service_role";

GRANT UPDATE ON public."goal_check_ins" TO "service_role";

GRANT DELETE ON public."goal_check_ins" TO "service_role";

GRANT TRUNCATE ON public."goal_check_ins" TO "service_role";

GRANT REFERENCES ON public."goal_check_ins" TO "service_role";

GRANT TRIGGER ON public."goal_check_ins" TO "service_role";

GRANT INSERT ON public."hr_ugc_translations" TO "anon";

GRANT SELECT ON public."hr_ugc_translations" TO "anon";

GRANT UPDATE ON public."hr_ugc_translations" TO "anon";

GRANT DELETE ON public."hr_ugc_translations" TO "anon";

GRANT TRUNCATE ON public."hr_ugc_translations" TO "anon";

GRANT REFERENCES ON public."hr_ugc_translations" TO "anon";

GRANT TRIGGER ON public."hr_ugc_translations" TO "anon";

GRANT INSERT ON public."hr_ugc_translations" TO "authenticated";

GRANT SELECT ON public."hr_ugc_translations" TO "authenticated";

GRANT UPDATE ON public."hr_ugc_translations" TO "authenticated";

GRANT DELETE ON public."hr_ugc_translations" TO "authenticated";

GRANT TRUNCATE ON public."hr_ugc_translations" TO "authenticated";

GRANT REFERENCES ON public."hr_ugc_translations" TO "authenticated";

GRANT TRIGGER ON public."hr_ugc_translations" TO "authenticated";

GRANT INSERT ON public."hr_ugc_translations" TO "service_role";

GRANT SELECT ON public."hr_ugc_translations" TO "service_role";

GRANT UPDATE ON public."hr_ugc_translations" TO "service_role";

GRANT DELETE ON public."hr_ugc_translations" TO "service_role";

GRANT TRUNCATE ON public."hr_ugc_translations" TO "service_role";

GRANT REFERENCES ON public."hr_ugc_translations" TO "service_role";

GRANT TRIGGER ON public."hr_ugc_translations" TO "service_role";

GRANT INSERT ON public."hr_notifications" TO "authenticated";

GRANT SELECT ON public."hr_notifications" TO "authenticated";

GRANT UPDATE ON public."hr_notifications" TO "authenticated";

GRANT DELETE ON public."hr_notifications" TO "authenticated";

GRANT TRUNCATE ON public."hr_notifications" TO "authenticated";

GRANT REFERENCES ON public."hr_notifications" TO "authenticated";

GRANT TRIGGER ON public."hr_notifications" TO "authenticated";

GRANT INSERT ON public."hr_notifications" TO "service_role";

GRANT SELECT ON public."hr_notifications" TO "service_role";

GRANT UPDATE ON public."hr_notifications" TO "service_role";

GRANT DELETE ON public."hr_notifications" TO "service_role";

GRANT TRUNCATE ON public."hr_notifications" TO "service_role";

GRANT REFERENCES ON public."hr_notifications" TO "service_role";

GRANT TRIGGER ON public."hr_notifications" TO "service_role";

GRANT INSERT ON public."hr_user_settings" TO "authenticated";

GRANT SELECT ON public."hr_user_settings" TO "authenticated";

GRANT UPDATE ON public."hr_user_settings" TO "authenticated";

GRANT DELETE ON public."hr_user_settings" TO "authenticated";

GRANT TRUNCATE ON public."hr_user_settings" TO "authenticated";

GRANT REFERENCES ON public."hr_user_settings" TO "authenticated";

GRANT TRIGGER ON public."hr_user_settings" TO "authenticated";

GRANT INSERT ON public."hr_user_settings" TO "service_role";

GRANT SELECT ON public."hr_user_settings" TO "service_role";

GRANT UPDATE ON public."hr_user_settings" TO "service_role";

GRANT DELETE ON public."hr_user_settings" TO "service_role";

GRANT TRUNCATE ON public."hr_user_settings" TO "service_role";

GRANT REFERENCES ON public."hr_user_settings" TO "service_role";

GRANT TRIGGER ON public."hr_user_settings" TO "service_role";

GRANT INSERT ON public."employees" TO "authenticated";

GRANT SELECT ON public."employees" TO "authenticated";

GRANT UPDATE ON public."employees" TO "authenticated";

GRANT DELETE ON public."employees" TO "authenticated";

GRANT TRUNCATE ON public."employees" TO "authenticated";

GRANT REFERENCES ON public."employees" TO "authenticated";

GRANT TRIGGER ON public."employees" TO "authenticated";

GRANT INSERT ON public."employees" TO "service_role";

GRANT SELECT ON public."employees" TO "service_role";

GRANT UPDATE ON public."employees" TO "service_role";

GRANT DELETE ON public."employees" TO "service_role";

GRANT TRUNCATE ON public."employees" TO "service_role";

GRANT REFERENCES ON public."employees" TO "service_role";

GRANT TRIGGER ON public."employees" TO "service_role";

GRANT INSERT ON public."workload_tasks" TO "authenticated";

GRANT SELECT ON public."workload_tasks" TO "authenticated";

GRANT UPDATE ON public."workload_tasks" TO "authenticated";

GRANT DELETE ON public."workload_tasks" TO "authenticated";

GRANT TRUNCATE ON public."workload_tasks" TO "authenticated";

GRANT REFERENCES ON public."workload_tasks" TO "authenticated";

GRANT TRIGGER ON public."workload_tasks" TO "authenticated";

GRANT INSERT ON public."workload_tasks" TO "service_role";

GRANT SELECT ON public."workload_tasks" TO "service_role";

GRANT UPDATE ON public."workload_tasks" TO "service_role";

GRANT DELETE ON public."workload_tasks" TO "service_role";

GRANT TRUNCATE ON public."workload_tasks" TO "service_role";

GRANT REFERENCES ON public."workload_tasks" TO "service_role";

GRANT TRIGGER ON public."workload_tasks" TO "service_role";

GRANT INSERT ON public."time_entries" TO "authenticated";

GRANT SELECT ON public."time_entries" TO "authenticated";

GRANT UPDATE ON public."time_entries" TO "authenticated";

GRANT DELETE ON public."time_entries" TO "authenticated";

GRANT TRUNCATE ON public."time_entries" TO "authenticated";

GRANT REFERENCES ON public."time_entries" TO "authenticated";

GRANT TRIGGER ON public."time_entries" TO "authenticated";

GRANT INSERT ON public."time_entries" TO "service_role";

GRANT SELECT ON public."time_entries" TO "service_role";

GRANT UPDATE ON public."time_entries" TO "service_role";

GRANT DELETE ON public."time_entries" TO "service_role";

GRANT TRUNCATE ON public."time_entries" TO "service_role";

GRANT REFERENCES ON public."time_entries" TO "service_role";

GRANT TRIGGER ON public."time_entries" TO "service_role";

GRANT INSERT ON public."open_punches" TO "authenticated";

GRANT SELECT ON public."open_punches" TO "authenticated";

GRANT UPDATE ON public."open_punches" TO "authenticated";

GRANT DELETE ON public."open_punches" TO "authenticated";

GRANT TRUNCATE ON public."open_punches" TO "authenticated";

GRANT REFERENCES ON public."open_punches" TO "authenticated";

GRANT TRIGGER ON public."open_punches" TO "authenticated";

GRANT INSERT ON public."open_punches" TO "service_role";

GRANT SELECT ON public."open_punches" TO "service_role";

GRANT UPDATE ON public."open_punches" TO "service_role";

GRANT DELETE ON public."open_punches" TO "service_role";

GRANT TRUNCATE ON public."open_punches" TO "service_role";

GRANT REFERENCES ON public."open_punches" TO "service_role";

GRANT TRIGGER ON public."open_punches" TO "service_role";

GRANT USAGE, SELECT ON SEQUENCE public."employees_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."interview_schedules_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."job_applications_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."job_postings_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."leave_requests_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."overtime_logs_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."proof_file_audit_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."skills_assessments_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."time_entries_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."time_tracking_summary_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."user_emails_id_seq" TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public."workload_tasks_id_seq" TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', true), ('employee-photos', 'employee-photos', true) ON CONFLICT (id) DO NOTHING;

RESET check_function_bodies;

RESET search_path;
