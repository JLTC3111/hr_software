import React, { useState } from 'react';
import { Star, TrendingUp, Calendar, User, Award, Target, MessageSquare, Plus, Edit, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const PerformanceAppraisal = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id ? String(employees[0].id) : null);
  const [selectedPeriod, setSelectedPeriod] = useState('2024-q4');
  const [activeTab, setActiveTab] = useState('overview');
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const performanceData = {
    [String(employees[0]?.id)]: {
      overallRating: 4.5,
      goals: [
        { id: 1, title: t('goals.completeReactProject'), status: 'completed', progress: 100, deadline: '2024-09-30' },
        { id: 2, title: t('goals.improveCodeQuality'), status: 'in-progress', progress: 75, deadline: '2024-12-31' },
        { id: 3, title: t('goals.mentoringJuniorDevelopers'), status: 'pending', progress: 30, deadline: '2024-11-15' }
      ],
      reviews: [
        { id: 1, reviewer: 'John Manager', rating: 4.5, date: '2024-08-15', type: t('reviewTypes.quarterlyReview') },
        { id: 2, reviewer: 'Sarah Lead', rating: 4.0, date: '2024-06-30', type: t('reviewTypes.midYearReview') }
      ],
      skills: [
        { name: t('skillCategories.technical'), rating: 4.5, category: 'technical' },
        { name: t('skillCategories.communication'), rating: 4.0, category: 'soft' },
        { name: t('skillCategories.leadership'), rating: 3.5, category: 'soft' },
        { name: t('performance.problemSolving'), rating: 4.8, category: 'technical' }
      ]
    },
    [String(employees[1]?.id)]: {
      overallRating: 4.2,
      goals: [
        { id: 1, title: t('goals.apiDevelopment'), status: 'completed', progress: 100, deadline: '2024-08-30' },
        { id: 2, title: t('goals.databaseOptimization'), status: 'in-progress', progress: 85, deadline: '2024-10-31' }
      ],
      reviews: [
        { id: 1, reviewer: 'Alice Director', rating: 4.2, date: '2024-08-20', type: t('reviewTypes.quarterlyReview') }
      ],
      skills: [
        { name: t('goals.backendDevelopment'), rating: 4.8, category: 'technical' },
        { name: t('goals.teamCollaboration'), rating: 4.0, category: 'soft' }
      ]
    }
  };

  const currentData = performanceData[selectedEmployee] || {
    overallRating: 0,
    goals: [],
    reviews: [],
    skills: []
  };

  const periods = [
    { value: '2024-q4', label: t('performance.q4_2024') },
    { value: '2024-q3', label: t('performance.q3_2024') },
    { value: '2024-q2', label: t('performance.q2_2024') },
    { value: '2024-q1', label: t('performance.q1_2024') }
  ];

  const StarRating = ({ rating, size = 'w-5 h-5' }) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
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
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  const ProgressBar = ({ progress, color = 'bg-blue-600' }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );

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
        <StarRating rating={currentData.overallRating} size="w-6 h-6" />
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
            <div className="p-3 bg-blue-100 rounded-full">
              <Target className="h-6 w-6 text-blue-600" />
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
            <div className="p-3 bg-green-100 rounded-full">
              <Award className="h-6 w-6 text-green-600" />
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
            <div className="p-3 bg-purple-100 rounded-full">
              <Star className="h-6 w-6 text-purple-600" />
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderColor: '#2563eb'
            }}
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
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                  {getStatusText(goal.status)}
                </span>
              </div>
              <div className="mb-2">
                <ProgressBar progress={goal.progress} />
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
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderColor: '#2563eb'
          }}
        >
          <Plus className="h-4 w-4" />
          <span>{t('performance.addNewGoal')}</span>
        </button>
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
                <Target className="h-5 w-5 text-blue-600" />
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
                  className="p-2 hover:bg-gray-100 rounded"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
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
                  className="text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    borderColor: 'transparent'
                  }}
                >
                  {goal.progress}%
                </span>
              </div>
              <ProgressBar progress={goal.progress} />
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
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderColor: '#2563eb'
          }}
        >
          <Plus className="h-4 w-4" />
          <span>{t('performance.newReview')}</span>
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
                className="px-3 py-1 text-sm border rounded"
                style={{
                  backgroundColor: 'transparent',
                  color: '#2563eb',
                  borderColor: '#2563eb'
                }}
              >
                {t('performance.viewFullReview')}
              </button>
              <button 
                className="px-3 py-1 text-sm flex items-center space-x-1"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  borderColor: 'transparent'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 
          className="text-2xl font-bold"
          style={{
            backgroundColor: 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: 'transparent'
          }}
        >
          {t('performance.title')}
        </h2>
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
                  ? 'border-blue-500 text-blue-600'
                  : `border-transparent hover:border-gray-300`
              }`}
              style={{
                color: activeTab === tab.id 
                  ? '#2563eb' 
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
    </div>
  );
};

export default PerformanceAppraisal;
