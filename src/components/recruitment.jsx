import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Eye, X, Check, XCircle, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getAllApplications,
  updateApplicationStatus,
  createInterviewSchedule,
  getRecruitmentStats
} from '../services/recruitmentService';

const Recruitment = () => {
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  
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
      case 'under review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'shortlisted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'interview scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'offer extended': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'hired': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
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
            label={t('recruitment.shortlisted', 'Shortlisted')}
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
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
                  {t('recruitment.status', 'Status')}
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
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
                  >
                    <td className={`px-6 py-4 whitespace-nowrap`}>
                      <div>
                        <div className={`text-sm font-medium ${text.primary}`}>
                          {application.applicant?.full_name || 'N/A'}
                        </div>
                        <div className={`text-sm ${text.secondary}`}>
                          {application.applicant?.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.job_posting?.position || 'N/A'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.job_posting?.department || 'N/A'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {application.applicant?.years_of_experience || 0} years
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
                        {application.status}
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
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title={t('recruitmentActions.view', 'View')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {application.status === 'shortlisted' && (
                          <button 
                            onClick={() => handleScheduleInterview(application)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title={t('recruitmentActions.schedule', 'Schedule Interview')}
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}
                        {application.status !== 'rejected' && application.status !== 'hired' && (
                          <button 
                            onClick={() => handleStatusUpdate(application.id, 'rejected')}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, color, onClick, active }) => {
  const { text, border } = useTheme();
  
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900',
    yellow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900',
    purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900',
    green: 'border-green-500 bg-green-50 dark:bg-green-900',
    red: 'border-red-500 bg-red-50 dark:bg-red-900'
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
        active ? colorClasses[color] : `${border.primary} bg-white dark:bg-gray-800`
      }`}
    >
      <div className={`text-sm font-medium ${text.secondary} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${text.primary}`}>{value}</div>
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
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Job Details */}
          <div>
            <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>Job Details</h3>
            <div className="space-y-2">
              <DetailRow label="Position" value={application.job_posting?.title} />
              <DetailRow label="Department" value={application.job_posting?.department} />
              <DetailRow label="Applied Date" value={new Date(application.application_date).toLocaleDateString()} />
              <DetailRow label="Status" value={application.status} />
            </div>
          </div>

          {/* Applicant Details */}
          <div>
            <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>Applicant Information</h3>
            <div className="space-y-2">
              <DetailRow label="Email" value={application.applicant?.email} />
              <DetailRow label="Phone" value={application.applicant?.phone} />
              <DetailRow label="Experience" value={`${application.applicant?.years_of_experience || 0} years`} />
              <DetailRow label="Current Company" value={application.applicant?.current_company || 'N/A'} />
              <DetailRow label="Current Position" value={application.applicant?.current_position || 'N/A'} />
              <DetailRow label="Education" value={application.applicant?.education_level || 'N/A'} />
            </div>
          </div>

          {/* Links */}
          {(application.applicant?.resume_url || application.applicant?.linkedin_profile) && (
            <div>
              <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>Links</h3>
              <div className="space-y-2">
                {application.applicant?.resume_url && (
                  <a 
                    href={application.applicant.resume_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-2"
                  >
                    <span>View Resume</span>
                  </a>
                )}
                {application.applicant?.linkedin_profile && (
                  <a 
                    href={application.applicant.linkedin_profile} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-2"
                  >
                    <span>LinkedIn Profile</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {application.notes && (
            <div>
              <h3 className={`text-lg font-semibold ${text.primary} mb-3`}>Notes</h3>
              <p className={`text-sm ${text.secondary}`}>{application.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end p-6 border-t ${border.primary} space-x-3`}>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Detail Row Component
const DetailRow = ({ label, value }) => {
  const { text } = useTheme();
  
  return (
    <div className="flex">
      <span className={`w-40 font-medium ${text.secondary}`}>{label}:</span>
      <span className={`flex-1 ${text.primary}`}>{value || 'N/A'}</span>
    </div>
  );
};

export default Recruitment;
