import React, { useState, useCallback, memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

const StatsCard = memo(({ title, value, icon: Icon, staticIcon: StaticIcon, color, size, onClick, isDarkMode, iconProps = {}, staticIconProps = {}, iconHoverOnly = false }) => {
  const { bg, text, border } = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  
  // Memoize hover handlers
  const handleMouseEnter = useCallback(() => setIsHovering(true), []);
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);
  
  return (
    <div 
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${bg.secondary} p-6 rounded-lg shadow-sm border ${border.primary} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''} group scale-in`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary} transition-colors duration-200`}>{title}</p>
          <p className={`text-2xl font-bold ${text.primary} transition-all duration-200 group-hover:scale-105`}>{value}</p>
        </div>
        <div className="transition-transform duration-300 group-hover:scale-110">
          {(!iconHoverOnly || isHovering) && Icon ? (
            <Icon className="h-6 w-6 m-2" color={color} size={size} isDarkMode={isDarkMode} {...iconProps} />
          ) : StaticIcon ? (
            <StaticIcon className="h-6 w-6 m-2" color={color} size={size} {...staticIconProps} />
          ) : Icon ? (
            <Icon className="h-6 w-6 m-2" color={color} size={size} isDarkMode={isDarkMode} {...iconProps} />
          ) : null}
        </div>
      </div>
    </div>
  );
});

// Display name for debugging
StatsCard.displayName = 'StatsCard';

export default StatsCard;
