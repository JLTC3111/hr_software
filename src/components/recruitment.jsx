import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Plus, Calendar, Eye, X, Check, XCircle, Star, FileText, Users, ClipboardCheck, UserCheck, ChevronRight, ChevronDown, Briefcase, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getAllApplications,
  updateApplicationStatus,
  createInterviewSchedule,
  getRecruitmentStats,
  createJobPosting
} from '../services/recruitmentService';
import { isDemoMode, getDemoApplicationStatus, getDemoApplicationNotes, getDemoJobTitle } from '../utils/demoHelper';

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
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'table'
  const [expandedStage, setExpandedStage] = useState(null);
  
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

  const filteredApplications = useMemo(() => {
    return filterStatus === 'all' 
      ? applications 
      : applications.filter(app => app.status === filterStatus);
  }, [applications, filterStatus]);

  // Group applications by pipeline stage
  const pipelineData = useMemo(() => {
    const stages = {
      'under review': { 
        key: 'underReview',
        label: t('recruitment.pipeline.screening', 'Screening'),
        description: t('recruitment.pipeline.screeningDesc', 'Initial application review'),
        icon: FileText,
        color: 'yellow',
        applications: []
      },
      'shortlisted': { 
        key: 'shortlisted',
        label: t('recruitment.pipeline.shortlisted', 'Shortlisted'),
        description: t('recruitment.pipeline.shortlistedDesc', 'Qualified candidates'),
        icon: Users,
        color: 'blue',
        applications: []
      },
      'interview scheduled': { 
        key: 'interview',
        label: t('recruitment.pipeline.interview', 'Interview'),
        description: t('recruitment.pipeline.interviewDesc', 'Interview process'),
        icon: ClipboardCheck,
        color: 'purple',
        applications: []
      },
      'offer extended': { 
        key: 'offer',
        label: t('recruitment.pipeline.offer', 'Offer'),
        description: t('recruitment.pipeline.offerDesc', 'Job offer extended'),
        icon: Briefcase,
        color: 'orange',
        applications: []
      },
      'hired': { 
        key: 'hired',
        label: t('recruitment.pipeline.hired', 'Hired'),
        description: t('recruitment.pipeline.hiredDesc', 'Successfully hired'),
        icon: UserCheck,
        color: 'green',
        applications: []
      },
      'rejected': { 
        key: 'rejected',
        label: t('recruitment.pipeline.rejected', 'Rejected'),
        description: t('recruitment.pipeline.rejectedDesc', 'Not proceeding'),
        icon: XCircle,
        color: 'red',
        applications: []
      }
    };

    applications.forEach(app => {
      const status = app.status?.toLowerCase() || 'under review';
      if (stages[status]) {
        stages[status].applications.push(app);
      }
    });

    return stages;
  }, [applications, t]);

  // Calculate pipeline metrics
  const pipelineMetrics = useMemo(() => {
    const total = applications.length;
    const activeInPipeline = applications.filter(a => 
      !['hired', 'rejected'].includes(a.status?.toLowerCase())
    ).length;
    const conversionRate = total > 0 
      ? ((pipelineData.hired.applications.length / total) * 100).toFixed(1)
      : 0;
    const avgTimeToHire = '14'; // Placeholder - would calculate from actual data
    
    return { total, activeInPipeline, conversionRate, avgTimeToHire };
  }, [applications, pipelineData]);

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
        <div>
          <h2 className={`text-2xl font-bold ${text.primary}`}>
            {t('recruitment.title', 'Recruitment')}
          </h2>
          <p className={`text-sm ${text.secondary} mt-1`}>
            {t('recruitment.subtitle', 'Manage your hiring pipeline and track candidates')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className={`flex rounded-lg border ${border.primary} overflow-hidden`}>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'pipeline'
                  ? 'bg-blue-600 text-white'
                  : `${bg.secondary} ${text.secondary} hover:${bg.tertiary}`
              }`}
            >
              {t('recruitment.pipelineView', 'Pipeline')}
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : `${bg.secondary} ${text.secondary} hover:${bg.tertiary}`
              }`}
            >
              {t('recruitment.tableView', 'Table')}
            </button>
          </div>
          <button 
            onClick={() => setShowPostJobModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('recruitment.postNewJob', 'Post New Job')}</span>
          </button>
        </div>
      </div>

      {/* Pipeline Metrics Summary */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
        <MetricCard
          icon={Users}
          label={t('recruitment.metrics.totalCandidates', 'Total Candidates')}
          value={pipelineMetrics.total}
          color="blue"
        />
        <MetricCard
          icon={TrendingUp}
          label={t('recruitment.metrics.activeInPipeline', 'Active in Pipeline')}
          value={pipelineMetrics.activeInPipeline}
          color="purple"
        />
        <MetricCard
          icon={UserCheck}
          label={t('recruitment.metrics.conversionRate', 'Conversion Rate')}
          value={`${pipelineMetrics.conversionRate}%`}
          color="green"
        />
        <MetricCard
          icon={Clock}
          label={t('recruitment.metrics.avgTimeToHire', 'Avg. Time to Hire')}
          value={`${pipelineMetrics.avgTimeToHire} ${t('common.days', 'days')}`}
          color="orange"
        />
      </div>

      {/* Visual Pipeline Timeline */}
      {viewMode === 'pipeline' && (
        <RecruitmentPipeline
          pipelineData={pipelineData}
          expandedStage={expandedStage}
          setExpandedStage={setExpandedStage}
          onViewApplication={(app) => {
            setSelectedApplication(app);
            setShowDetailModal(true);
          }}
          onStatusUpdate={handleStatusUpdate}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Stats Cards - Only show in table view */}
      {viewMode === 'table' && stats && (
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

      {/* Applications Table - Only show in table view */}
      {viewMode === 'table' && (
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
                          <Star className={`w-4 h-4 ${isDarkMode ? 'text-white fill-white' : 'text-gray-800 fill-gray-800'}`} />
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
                    <td className={`text-center px-6 py-4 whitespace-nowrap text-sm ${text.primary}`}>
                      {formatDate(application.application_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 justify-center">
                        <button 
                          onClick={() => {
                            setSelectedApplication(application);
                            setShowDetailModal(true);
                          }}
                          className={`cursor-pointer ${isDarkMode ? 'text-white hover:text-blue-300' : 'text-gray-800 hover:text-blue-600'}`}
                          title={t('recruitmentActions.view', 'View')}
                        >
                          <Eye className={`w-5 h-5`} />
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
                            className={`cursor-pointer ${isDarkMode ? 'text-red-400 hover:rotate-360' : 'text-red-800 hover:rotate-360' } transition-transform duration-200`}
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
      )}

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

// Metric Card Component
const MetricCard = memo(({ icon: Icon, label, value, color }) => {
  const { text, border, isDarkMode, bg } = useTheme();
  
  const colorConfig = {
    blue: { bg: isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50', icon: isDarkMode ? 'text-blue-400' : 'text-blue-600' },
    purple: { bg: isDarkMode ? 'bg-purple-900/50' : 'bg-purple-50', icon: isDarkMode ? 'text-purple-400' : 'text-purple-600' },
    green: { bg: isDarkMode ? 'bg-green-900/50' : 'bg-green-50', icon: isDarkMode ? 'text-green-400' : 'text-green-600' },
    orange: { bg: isDarkMode ? 'bg-orange-900/50' : 'bg-orange-50', icon: isDarkMode ? 'text-orange-400' : 'text-orange-600' }
  };

  const config = colorConfig[color] || colorConfig.blue;

  return (
    <div className={`${bg.secondary} rounded-xl p-4 border ${border.primary} hover:shadow-md transition-shadow`}>
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.icon}`} />
        </div>
        <div>
          <p className={`text-xs font-medium ${text.secondary}`}>{label}</p>
          <p className={`text-xl font-bold ${text.primary}`}>{value}</p>
        </div>
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

// Recruitment Pipeline Component
const RecruitmentPipeline = memo(({ 
  pipelineData, 
  expandedStage, 
  setExpandedStage, 
  onViewApplication, 
  onStatusUpdate,
  formatDate,
  getStatusColor
}) => {
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();

  const stages = ['under review', 'shortlisted', 'interview scheduled', 'offer extended', 'hired'];
  
  const colorConfig = {
    yellow: { 
      bg: isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50',
      border: 'border-yellow-500',
      text: isDarkMode ? 'text-yellow-400' : 'text-yellow-700',
      dot: 'bg-yellow-500'
    },
    blue: { 
      bg: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
      border: 'border-blue-500',
      text: isDarkMode ? 'text-blue-400' : 'text-blue-700',
      dot: 'bg-blue-500'
    },
    purple: { 
      bg: isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50',
      border: 'border-purple-500',
      text: isDarkMode ? 'text-purple-400' : 'text-purple-700',
      dot: 'bg-purple-500'
    },
    orange: { 
      bg: isDarkMode ? 'bg-orange-900/30' : 'bg-orange-50',
      border: 'border-orange-500',
      text: isDarkMode ? 'text-orange-400' : 'text-orange-700',
      dot: 'bg-orange-500'
    },
    green: { 
      bg: isDarkMode ? 'bg-green-900/30' : 'bg-green-50',
      border: 'border-green-500',
      text: isDarkMode ? 'text-green-400' : 'text-green-700',
      dot: 'bg-green-500'
    },
    red: { 
      bg: isDarkMode ? 'bg-red-900/30' : 'bg-red-50',
      border: 'border-red-500',
      text: isDarkMode ? 'text-red-400' : 'text-red-700',
      dot: 'bg-red-500'
    }
  };

  return (
    <div className={`${bg.secondary} rounded-xl border ${border.primary} p-6`}>
      {/* Pipeline Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-lg font-semibold ${text.primary}`}>
          {t('recruitment.pipeline.title', 'Recruitment Pipeline')}
        </h3>
        <div className={`text-sm ${text.secondary}`}>
          {t('recruitment.pipeline.clickToExpand', 'Click stages to view candidates')}
        </div>
      </div>

      {/* Visual Pipeline Timeline */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-8 left-0 right-0 h-1 bg-linear-to-r from-yellow-500 via-purple-500 to-green-500 rounded-full opacity-30" />
        
        {/* Stages */}
        <div className="grid grid-cols-5 gap-2 md:gap-4 relative z-10">
          {stages.map((stageKey, index) => {
            const stage = pipelineData[stageKey];
            if (!stage) return null;
            
            const Icon = stage.icon;
            const config = colorConfig[stage.color];
            const isExpanded = expandedStage === stageKey;
            const count = stage.applications.length;

            return (
              <div key={stageKey} className="flex flex-col items-center">
                {/* Stage Circle */}
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : stageKey)}
                  className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full ${config.bg} border-2 ${config.border} flex items-center justify-center transition-all duration-300 hover:scale-110 cursor-pointer ${isExpanded ? 'ring-4 ring-offset-2 ring-offset-gray-900 ' + config.border.replace('border-', 'ring-') : ''}`}
                >
                  <Icon className={`w-6 h-6 md:w-7 md:h-7 ${config.text}`} />
                  {/* Count Badge */}
                  {count > 0 && (
                    <span className={`absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 ${config.dot} text-white text-xs font-bold rounded-full flex items-center justify-center`}>
                      {count}
                    </span>
                  )}
                </button>

                {/* Stage Label */}
                <div className="mt-3 text-center">
                  <p className={`text-xs md:text-sm font-medium ${text.primary} line-clamp-1`}>
                    {stage.label}
                  </p>
                  <p className={`text-xs ${text.secondary} hidden md:block`}>
                    {count} {t('recruitment.candidates', 'candidates')}
                  </p>
                </div>

                {/* Arrow */}
                {index < stages.length - 1 && (
                  <div className="absolute top-8 hidden md:block" style={{ left: `${(index + 1) * 20 - 2}%` }}>
                    <ArrowRight className={`w-4 h-4 ${text.secondary}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Stage Details */}
      {expandedStage && pipelineData[expandedStage] && (
        <div className={`mt-6 pt-6 border-t ${border.primary}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              {(() => {
                const stage = pipelineData[expandedStage];
                const Icon = stage.icon;
                const config = colorConfig[stage.color];
                return (
                  <>
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.text}`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${text.primary}`}>{stage.label}</h4>
                      <p className={`text-sm ${text.secondary}`}>{stage.description}</p>
                    </div>
                  </>
                );
              })()}
            </div>
            <button
              onClick={() => setExpandedStage(null)}
              className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
            >
              <X className={`w-5 h-5 ${text.secondary}`} />
            </button>
          </div>

          {/* Candidates List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pipelineData[expandedStage].applications.length === 0 ? (
              <div className={`text-center py-8 ${text.secondary}`}>
                {t('recruitment.pipeline.noCandidates', 'No candidates in this stage')}
              </div>
            ) : (
              pipelineData[expandedStage].applications.map(app => (
                <CandidateCard
                  key={app.id}
                  application={app}
                  onView={() => onViewApplication(app)}
                  onStatusUpdate={onStatusUpdate}
                  formatDate={formatDate}
                  currentStage={expandedStage}
                  stages={stages}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Rejected Section (Separate) */}
      {pipelineData.rejected?.applications.length > 0 && (
        <div className={`mt-6 pt-6 border-t ${border.primary}`}>
          <button
            onClick={() => setExpandedStage(expandedStage === 'rejected' ? null : 'rejected')}
            className={`flex items-center justify-between w-full p-3 rounded-lg ${colorConfig.red.bg} border ${colorConfig.red.border} cursor-pointer transition-all hover:opacity-80`}
          >
            <div className="flex items-center space-x-3">
              <XCircle className={`w-5 h-5 ${colorConfig.red.text}`} />
              <span className={`font-medium ${colorConfig.red.text}`}>
                {t('recruitment.pipeline.rejected', 'Rejected')} ({pipelineData.rejected.applications.length})
              </span>
            </div>
            {expandedStage === 'rejected' ? (
              <ChevronDown className={`w-5 h-5 ${colorConfig.red.text}`} />
            ) : (
              <ChevronRight className={`w-5 h-5 ${colorConfig.red.text}`} />
            )}
          </button>

          {expandedStage === 'rejected' && (
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
              {pipelineData.rejected.applications.map(app => (
                <CandidateCard
                  key={app.id}
                  application={app}
                  onView={() => onViewApplication(app)}
                  formatDate={formatDate}
                  currentStage="rejected"
                  isRejected
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

RecruitmentPipeline.displayName = 'RecruitmentPipeline';

// Candidate Card Component
const CandidateCard = memo(({ application, onView, onStatusUpdate, formatDate, currentStage, stages, isRejected }) => {
  const { t } = useLanguage();
  const { isDarkMode, bg, text, border } = useTheme();

  // Get next stage in pipeline
  const getNextStage = () => {
    if (!stages || isRejected) return null;
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= stages.length - 1) return null;
    return stages[currentIndex + 1];
  };

  const nextStage = getNextStage();

  const stageLabels = {
    'under review': t('recruitment.status.underreview', 'Under Review'),
    'shortlisted': t('recruitment.status.shortlisted', 'Shortlisted'),
    'interview scheduled': t('recruitment.status.interviewscheduled', 'Interview'),
    'offer extended': t('recruitment.status.offerextended', 'Offer'),
    'hired': t('recruitment.status.hired', 'Hired')
  };

  return (
    <div className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4 border ${border.primary} hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h5 className={`font-medium ${text.primary} truncate`}>
              {application.applicant?.full_name || 
               `${application.applicant?.first_name || ''} ${application.applicant?.last_name || ''}`.trim() ||
               t('common.notAvailable', 'N/A')}
            </h5>
            {application.rating && (
              <div className="flex items-center">
                <Star className={`w-3 h-3 ${isDarkMode ? 'text-yellow-400 fill-yellow-400' : 'text-yellow-500 fill-yellow-500'}`} />
                <span className={`text-xs ${text.secondary} ml-1`}>{application.rating}</span>
              </div>
            )}
          </div>
          <p className={`text-sm ${text.secondary} truncate`}>
            {isDemoMode() ? getDemoJobTitle(application.job_posting, t) : application.job_posting?.title || application.job_posting?.position}
          </p>
          <div className="flex items-center space-x-3 mt-2">
            <span className={`text-xs ${text.secondary}`}>
              {application.applicant?.years_of_experience || 0} {t('recruitment.yearsExperience', 'years exp.')}
            </span>
            <span className={`text-xs ${text.secondary}`}>
              {formatDate(application.application_date)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={onView}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors cursor-pointer`}
            title={t('common.view', 'View')}
          >
            <Eye className={`w-4 h-4 ${text.secondary}`} />
          </button>
          
          {nextStage && onStatusUpdate && (
            <button
              onClick={() => onStatusUpdate(application.id, nextStage)}
              className={`p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer`}
              title={`${t('recruitment.moveTo', 'Move to')} ${stageLabels[nextStage] || nextStage}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          
          {!isRejected && onStatusUpdate && currentStage !== 'hired' && (
            <button
              onClick={() => onStatusUpdate(application.id, 'rejected')}
              className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-red-900/50' : 'hover:bg-red-50'} transition-colors cursor-pointer`}
              title={t('recruitment.reject', 'Reject')}
            >
              <XCircle className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

CandidateCard.displayName = 'CandidateCard';

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
              <DetailRow label={t('recruitment.position', 'Position')} value={isDemoMode() ? getDemoJobTitle(application.job_posting, t) : application.job_posting?.title} />
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
              <DetailRow label={t('recruitment.currentPosition', 'Current Position')} value={isDemoMode() ? t(application.applicant?.currentPositionKey, application.applicant?.current_position) : application.applicant?.current_position} />
              <DetailRow label={t('recruitment.education', 'Education')} value={isDemoMode() ? t(application.applicant?.educationLevelKey, application.applicant?.education_level) : application.applicant?.education_level} />
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
              <p className={`text-sm ${text.secondary}`}>{isDemoMode() ? getDemoApplicationNotes(application, t) : application.notes}</p>
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
