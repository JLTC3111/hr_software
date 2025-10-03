import React from 'react'
import { Plus } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'

const Recruitment = ({ applications }) => {
  const { t } = useLanguage();
  const { isDarkMode, toggleTheme, button, bg, text, border, hover, input } = useTheme();
  
  return (
    <div className="space-y-6 max-w-[800px] mx-auto justify-center items-center">
      <div className="flex justify-between items-center">
        <h2 
          className="text-2xl font-bold"
          style={{
            backgroundColor: isDarkMode ? 'transparent' : 'transparent',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          {t('recruitment.title')}
        </h2>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderColor: '#2563eb'
          }}
        >
          <Plus className="h-4 w-4" />
          <span>{t('recruitment.postNewJob')}</span>
        </button>
      </div>

      <div 
        className="rounded-lg shadow-sm border"
        style={{
          backgroundColor: isDarkMode ? '#374151' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#111827',
          borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
        }}
      >
        <div 
          className="p-6 border-b"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <h3 
            className="text-lg font-semibold"
            style={{
              backgroundColor: 'transparent',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: 'transparent'
            }}
          >
            {t('recruitment.applications')}
          </h3>
        </div>
      <div className="overflow-x-auto">
        <table 
          className="w-full"
          style={{
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#111827',
            borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
          }}
        >
          <thead 
            style={{
              backgroundColor: isDarkMode ? '#4b5563' : '#f9fafb',
              color: isDarkMode ? '#d1d5db' : '#6b7280',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.candidate')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.position')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.department')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.experience')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.status')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.appliedDate')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                style={{
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#d1d5db' : '#6b7280',
                  borderColor: 'transparent'
                }}
              >
                {t('recruitment.actions')}
              </th>
            </tr>
          </thead>
          <tbody 
            className="divide-y"
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#111827',
              borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            {applications.map(application => (
              <tr 
                key={application.id} 
                className="hover:bg-gray-50"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
                }}
                onMouseEnter={(e) => {
                  e.target.closest('tr').style.backgroundColor = isDarkMode ? '#4b5563' : '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.target.closest('tr').style.backgroundColor = isDarkMode ? '#374151' : '#ffffff';
                }}
              >
                <td 
                  className="px-6 py-4 whitespace-nowrap"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  <div>
                    <div 
                      className="text-sm font-medium"
                      style={{
                        backgroundColor: 'transparent',
                        color: isDarkMode ? '#ffffff' : '#111827',
                        borderColor: 'transparent'
                      }}
                    >
                      {application.candidateName}
                    </div>
                    <div 
                      className="text-sm"
                      style={{
                        backgroundColor: 'transparent',
                        color: isDarkMode ? '#d1d5db' : '#6b7280',
                        borderColor: 'transparent'
                      }}
                    >
                      {application.email}
                    </div>
                  </div>
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {application.position}
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {application.department}
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {application.experience}
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(application.status)}`}>
                    {t(`recruitmentStatus.${application.status.toLowerCase().replace(/\s+/g, '')}`, application.status)}
                  </span>
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap text-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  {application.appliedDate}
                </td>
                <td 
                  className="px-6 py-4 whitespace-nowrap text-sm font-medium"
                  style={{
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : '#111827',
                    borderColor: 'transparent'
                  }}
                >
                  <button 
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#2563eb',
                      borderColor: 'transparent'
                    }}
                  >
                    {t('recruitmentActions.view')}
                  </button>
                  <button 
                    className="text-green-600 hover:text-green-900 mr-3"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#16a34a',
                      borderColor: 'transparent'
                    }}
                  >
                    {t('recruitmentActions.schedule')}
                  </button>
                  <button 
                    className="text-red-600 hover:text-red-900"
                    style={{
                      backgroundColor: 'transparent',
                      color: '#dc2626',
                      borderColor: 'transparent'
                    }}
                  >
                    {t('recruitmentActions.reject')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
};

const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'interview scheduled': return 'bg-blue-100 text-blue-800';
    case 'under review': return 'bg-yellow-100 text-yellow-800';
    case 'offer extended': return 'bg-purple-100 text-purple-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default Recruitment;