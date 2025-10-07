import React from 'react'
import { Users, Briefcase, FileText, TrendingUp } from 'lucide-react'
import StatsCard from './statsCard.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

const Dashboard = ({ employees, applications }) => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard 
          title={t('dashboard.totalEmployees')} 
          value={employees.length} 
          icon={Users} 
          color="text-blue-600" 
        />
        <StatsCard 
          title={t('dashboard.activeEmployees')} 
          value="3" 
          icon={Briefcase} 
          color="text-green-600" 
        />
        <StatsCard 
          title={t('dashboard.pendingApplications')} 
          value={applications.length} 
          icon={FileText} 
          color="text-orange-600" 
        />
        <StatsCard 
          title={t('dashboard.avgPerformance')} 
          value="4.5" 
          icon={TrendingUp} 
          color="text-purple-600" 
        />
      </div>

      <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary}`}>
        <div className={`p-6 border-b ${border.primary}`}>
          <h3 className={`text-lg font-semibold ${text.primary}`}>{t('dashboard.recentActivity')}</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
