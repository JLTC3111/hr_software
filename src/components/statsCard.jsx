import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

const StatsCard = ({ title, value, icon: Icon, color }) => {
  const { bg, text, border } = useTheme();
  
  return (
    <div className={`${bg.secondary} p-6 rounded-lg shadow-sm border ${border.primary}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary}`}>{title}</p>
          <p className={`text-2xl font-bold ${text.primary}`}>{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${color}`} />
      </div>
    </div>
  );
};

export default StatsCard;
