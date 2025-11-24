import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

const StatsCard = ({ title, value, icon: Icon, color, size, onClick }) => {
  const { bg, text, border } = useTheme();
  
  return (
    <div 
      onClick={onClick}
      className={`${bg.secondary} p-6 rounded-lg shadow-sm border ${border.primary} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''} group scale-in`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary} transition-colors duration-200`}>{title}</p>
          <p className={`text-2xl font-bold ${text.primary} transition-all duration-200 group-hover:scale-105`}>{value}</p>
        </div>
        <div className="transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-6 w-6 m-2" color={color} size={size} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
