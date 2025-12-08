import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Eye, X, Check, XCircle, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getAllApplications,
  updateApplicationStatus,
  createInterviewSchedule,
  getRecruitmentStats,
  createJobPosting
} from '../services/recruitmentService';
import { isDemoMode, getDemoApplicationStatus } from '../utils/demoHelper';

const Recruitment = () => {
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [applicationsResult, statsResult] = await Promise.all([
        getAllApplications(),
        getRecruitmentStats()
      ]);

      if (applicationsResult.success) {
        setApplications(applicationsResult.data);
      }
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error fetching recruitment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (applicationId, newStatus) => {
    try {
      const result = await updateApplicationStatus(applicationId, newStatus);
      if (result.success) {
        fetchData(); // Refresh data
        alert(t('recruitment.statusUpdated', 'Status updated successfully!'));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert(t('errors.updateFailed', 'Failed to update status'));
    }
  };

  const handleScheduleInterview = async (application) => {
    // This would open a modal to schedule interview
    // For now, just update status
    await handleStatusUpdate(application.id, 'interview scheduled');
  };

  const filteredApplications = filterStatus === 'all' 
    ? applications 
    : applications.filter(app => app.status === filterStatus);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'under review': return `${isDarkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`;
      case 'shortlisted': return `${isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'}`;
      case 'interview scheduled': return `${isDarkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-800'}`;
      case 'offer extended': return `${isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`;
      case 'hired': return `${isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`;
      case 'rejected': return `${isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'}`;
      default: return `${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('common.notAvailable', 'N/A');
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className={`text-2xl font-bold ${text.primary}`}>
          {t('recruitment.title', 'Recruitment')}
        </h2>
        <button 
          onClick={() => setShowPostJobModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{t('recruitment.postNewJob', 'Post New Job')}</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard
            label={t('recruitment.total', 'Total')}
            value={stats.total}
            color="blue"
            onClick={() => setFilterStatus('all')}
            active={filterStatus === 'all'}
          />
          <StatCard
            label={t('recruitment.underReview', 'Under Review')}
            value={stats.underReview}
            color="yellow"
            onClick={() => setFilterStatus('under review')}
            active={filterStatus === 'under review'}
          />
          <StatCard
            label={t('recruitment.shortListed', 'Shortlisted')}
            value={stats.shortlisted}
            color="blue"
            onClick={() => setFilterStatus('shortlisted')}
            active={filterStatus === 'shortlisted'}
          />
          <StatCard
            label={t('recruitment.interviews', 'Interviews')}
            value={stats.interviewScheduled}
            color="purple"
            onClick={() => setFilterStatus('interview scheduled')}
            active={filterStatus === 'interview scheduled'}
          />
          <StatCard
            label={t('recruitment.offers', 'Offers')}
            value={stats.offerExtended}
            color="green"
            onClick={() => setFilterStatus('offer extended')}
            active={filterStatus === 'offer extended'}
          />
          <StatCard
            label={t('recruitment.hired', 'Hired')}
            value={stats.hired}
            color="green"
            onClick={() => setFilterStatus('hired')}
            active={filterStatus === 'hired'}
          />
          <StatCard
            label={t('recruitment.rejected', 'Rejected')}
            value={stats.rejected}
            color="red"
            onClick={() => setFilterStatus('rejected')}
            active={filterStatus === 'rejected'}
          />
        </div>
      )}

      {/* Applications Table */}
      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} overflow-hidden`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${text.primary}`}>
            {t('recruitment.applications', 'Applications')}
            {filterStatus !== 'all' && ` - ${filterStatus}`}
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.candidate', 'Candidate')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.position', 'Position')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.department', 'Department')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.experience', 'Experience')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.rating', 'Rating')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.statusLabel', 'Status')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.appliedDate', 'Applied Date')}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${text.secondary}`}>
                  {t('recruitment.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${border.primary}`}>
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    {t('recruitment.noApplications', 'No applications found')}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(application => (
                  <tr 
                    key={application.id} 
                    className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <td className={`px-6 py-4 whitespace-nowrap`}>
                      <div>
                        <div className={`text-sm font-medium ${text.primary}`}>
                          {application.applicant?.full_name || application.applicant?.first_name 
                            ? `${application.applicant?.first_name || ''} ${application.applicant?.last_name || ''}`.trim() 
                            : t('common.notAvailable', 'N/A')}
                        </div>
                        <div className={`text-sm ${text.secondary}`}>
                          {application.applicant?.email || t('common.notAvailable', 'N/A')}
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.job_posting?.position 
                        ? t(`employeePosition.${application.job_posting.position}`, application.job_posting.position)
                        : t('common.notAvailable', 'N/A')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.job_posting?.department 
                        ? t(`employeeDepartment.${application.job_posting.department}`, application.job_posting.department)
                        : t('common.notAvailable', 'N/A')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.applicant?.years_of_experience || 0} {t('recruitment.years', 'years')}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap`}>
                      {application.rating ? (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className={`ml-1 text-sm ${text.primary}`}>{application.rating}/5</span>
                        </div>
                      ) : (
                        <span className={`text-sm ${text.secondary}`}>-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(application.status)}`}>
                        {isDemoMode()
                          ? getDemoApplicationStatus(application, t)
                          : t(`recruitment.status.${application.status?.toLowerCase().replace(/\s+/g, '')}`, application.status)
                        }
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {formatDate(application.application_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => {
                            setSelectedApplication(application);
                            setShowDetailModal(true);
                          }}
                          className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}`}
                          title={t('recruitmentActions.view', 'View')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {application.status === 'shortlisted' && (
                          <button 
                            onClick={() => handleScheduleInterview(application)}
                            className={`${isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-900'}`}
                            title={t('recruitmentActions.schedule', 'Schedule Interview')}
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}
                        {application.status !== 'rejected' && application.status !== 'hired' && (
                          <button 
                            onClick={() => handleStatusUpdate(application.id, 'rejected')}
                            className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'}`}
                            title={t('recruitmentActions.reject', 'Reject')}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Application Detail Modal */}
      {showDetailModal && selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApplication(null);
          }}
          onUpdate={fetchData}
        />
      )}

      {/* Post Job Modal */}
      {showPostJobModal && (
        <PostJobModal
          onClose={() => setShowPostJobModal(false)}
          onSuccess={() => {
            setShowPostJobModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, color, onClick, active }) => {
  const { text, border, isDarkMode } = useTheme();
  
  const colorClasses = {
    blue: `border-blue-500 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'}`,
    yellow: `border-yellow-500 ${isDarkMode ? 'bg-yellow-900' : 'bg-yellow-50'}`,
    purple: `border-purple-500 ${isDarkMode ? 'bg-purple-900' : 'bg-purple-50'}`,
    green: `border-green-500 ${isDarkMode ? 'bg-green-900' : 'bg-green-50'}`,
    red: `border-red-500 ${isDarkMode ? 'bg-red-900' : 'bg-red-50'}`
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
        active ? colorClasses[color] : `${border.primary} ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`
      }`}
    >
      <div className={`text-sm font-medium ${text.secondary} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${text.primary}`}>{value}</div>
    </div>
  );
};

// Post Job Modal Component
const PostJobModal = ({ onClose, onSuccess }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employment_type: 'full_time',
    experience_level: '',
    salary_min: '',
    salary_max: '',
    description: '',
    requirements: '',
    status: 'open'
  });

  const departments = [
    { value: 'engineering', label: t('employeeDepartment.engineering', 'Engineering') },
    { value: 'marketing', label: t('employeeDepartment.marketing', 'Marketing') },
    { value: 'sales', label: t('employeeDepartment.sales', 'Sales') },
    { value: 'finance', label: t('employeeDepartment.finance', 'Finance') },
    { value: 'human_resources', label: t('employeeDepartment.human_resources', 'Human Resources') },
    { value: 'operations', label: t('employeeDepartment.operations', 'Operations') },
    { value: 'customer_support', label: t('employeeDepartment.customer_support', 'Customer Support') },
    { value: 'product', label: t('employeeDepartment.product', 'Product') },
    { value: 'design', label: t('employeeDepartment.design', 'Design') },
    { value: 'it', label: t('employeeDepartment.it', 'IT') }
  ];

  const employmentTypes = [
    { value: 'full_time', label: t('recruitment.fullTime', 'Full Time') },
    { value: 'part_time', label: t('recruitment.partTime', 'Part Time') },
    { value: 'contract', label: t('recruitment.contract', 'Contract') },
    { value: 'internship', label: t('recruitment.internship', 'Internship') }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.department) {
      alert(t('validation.required', 'Please fill in required fields'));
      return;
    }

    setLoading(true);
    try {
      const result = await createJobPosting({
        ...formData,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null
      });

      if (result.success) {
        alert(t('recruitment.jobPosted', 'Job posted successfully!'));
        onSuccess();
      } else {
        alert(result.error || t('errors.saveFailed', 'Failed to post job'));
      }
    } catch (error) {
      console.error('Error posting job:', error);
      alert(t('errors.saveFailed', 'Failed to post job'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`${bg.primary} rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${border.primary}`}>
          <h2 className={`text-xl font-semibold ${text.primary}`}>{t('recruitment.postNewJob', 'Post New Job')}</h2>
          <button 
            onClick={onClose}
            className={`${text.secondary} hover:${text.primary} cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Title */}
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.jobTitle', 'Job Title')} *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder={t('recruitment.enterJobTitle', 'Enter job title')}
                required
              />
            </div>

            {/* Department */}
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.department', 'Department')} *
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                required
              >
                <option value="">{t('common.select', 'Select')}</option>
                {departments.map(dept => (
                  <option key={dept.value} value={dept.value}>{dept.label}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.location', 'Location')}
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder={t('recruitment.enterLocation', 'Enter location')}
              />
            </div>

            {/* Employment Type */}
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.employmentType', 'Employment Type')}
              </label>
              <select
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
              >
                {employmentTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Experience Level */}
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.experienceLevel', 'Experience Level')}
              </label>
              <input
                type="text"
                name="experience_level"
                value={formData.experience_level}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder={t('recruitment.enterExperience', 'e.g., 3-5 years')}
              />
            </div>

            {/* Salary Range */}
            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.salaryMin', 'Minimum Salary')}
              </label>
              <input
                type="number"
                name="salary_min"
                value={formData.salary_min}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder="0"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.salaryMax', 'Maximum Salary')}
              </label>
              <input
                type="number"
                name="salary_max"
                value={formData.salary_max}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder="0"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.description', 'Job Description')}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder={t('recruitment.enterDescription', 'Enter job description')}
              />
            </div>

            {/* Requirements */}
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${text.secondary} mb-1`}>
                {t('recruitment.requirements', 'Requirements')}
              </label>
              <textarea
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 py-2 rounded-lg border ${border.primary} ${bg.secondary} ${text.primary}`}
                placeholder={t('recruitment.enterRequirements', 'Enter job requirements')}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-end space-x-3 mt-6 pt-4 border-t ${border.primary}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} rounded-lg cursor-pointer`}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.saving', 'Saving...') : t('recruitment.postJob', 'Post Job')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Application Detail Modal
const ApplicationDetailModal = ({ application, onClose, onUpdate }) => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`${bg.secondary} rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${border.primary}`}>
          <h2 className={`text-2xl font-bold ${text.primary}`}>
            {application.applicant?.full_name}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
          >
            <X className="w-5 h-5" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Job Details */}
          <div>
            <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>{t('recruitment.jobDetails', 'Job Details')}</h3>
            <div className="space-y-2">
              <DetailRow label={t('recruitment.position', 'Position')} value={application.job_posting?.title} />
              <DetailRow label={t('recruitment.department', 'Department')} value={application.job_posting?.department ? t(`employeeDepartment.${application.job_posting.department}`, application.job_posting.department) : null} />
              <DetailRow label={t('recruitment.appliedDate', 'Applied Date')} value={application.application_date ? new Date(application.application_date).toLocaleDateString() : null} />
              <DetailRow
                label={t('recruitment.statusLabel', 'Status')}
                value={application.status ? (isDemoMode() ? getDemoApplicationStatus(application, t) : t(`recruitment.status.${application.status?.toLowerCase().replace(/\\s+/g, '')}`, application.status)) : null}
              />
            </div>
          </div>

          {/* Applicant Details */}
          <div>
            <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>{t('recruitment.applicantInfo', 'Applicant Information')}</h3>
            <div className="space-y-2">
              <DetailRow label={t('common.email', 'Email')} value={application.applicant?.email} />
              <DetailRow label={t('common.phone', 'Phone')} value={application.applicant?.phone} />
              <DetailRow label={t('recruitment.experience', 'Experience')} value={`${application.applicant?.years_of_experience || 0} ${t('recruitment.years', 'years')}`} />
              <DetailRow label={t('recruitment.currentCompany', 'Current Company')} value={application.applicant?.current_company} />
              <DetailRow label={t('recruitment.currentPosition', 'Current Position')} value={application.applicant?.current_position} />
              <DetailRow label={t('recruitment.education', 'Education')} value={application.applicant?.education_level} />
            </div>
          </div>

          {/* Links */}
          {(application.applicant?.resume_url || application.applicant?.linkedin_profile) && (
            <div>
              <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>{t('recruitment.links', 'Links')}</h3>
              <div className="space-y-2">
                {application.applicant?.resume_url && (
                  <a 
                    href={application.applicant.resume_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} flex items-center space-x-2`}
                  >
                    <span>{t('recruitment.viewResume', 'View Resume')}</span>
                  </a>
                )}
                {application.applicant?.linkedin_profile && (
                  <a 
                    href={application.applicant.linkedin_profile} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} flex items-center space-x-2`}
                  >
                    <span>{t('recruitment.linkedinProfile', 'LinkedIn Profile')}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {application.notes && (
            <div>
              <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>{t('recruitment.notes', 'Notes')}</h3>
              <p className={`text-sm ${text.secondary}`}>{application.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end p-6 border-t ${border.primary} space-x-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} rounded-lg cursor-pointer`}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Detail Row Component
const DetailRow = ({ label, value }) => {
  const { text } = useTheme();
  const { t } = useLanguage();
  
  return (
    <div className="flex">
      <span className={`w-40 font-medium ${text.secondary}`}>{label}:</span>
      <span className={`flex-1 ${text.primary}`}>{value || t('common.notAvailable', 'N/A')}</span>
    </div>
  );
};

export default Recruitment;
