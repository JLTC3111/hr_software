import React from 'react'
import { Plus, Calendar, Award } from 'lucide-react'

const ActivityItem = ({ type, message, time, style }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'employee': return { icon: Plus, color: 'bg-green-100 text-green-600' };
      case 'interview': return { icon: Calendar, color: 'bg-blue-100 text-blue-600' };
      case 'performance': return { icon: Award, color: 'bg-purple-100 text-purple-600' };
      default: return { icon: Plus, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const { icon: Icon, color } = getActivityIcon(type);

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg border" style={style}>
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: style?.color }}>{message}</p>
        <p className="text-sm opacity-70" style={{ color: style?.color }}>{time}</p>
      </div>
    </div>
  );
};

export default ActivityItem;
