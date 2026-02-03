import _React, { useState, useCallback, useMemo, memo } from 'react'
import { Phone, MapPin, Mail, Eye, Edit, Trash2, User, Camera, Network, Loader, TrendingUp, ChevronRight } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getDemoEmployeeName } from '../utils/demoHelper.js'

const getStatusConfig = (status, isDarkMode) => {
  const configs = {
    active: {
      bg: isDarkMode ? 'bg-green-900/50' : 'bg-green-100',
      text: isDarkMode ? 'text-green-400' : 'text-green-700',
      dot: 'bg-green-500',
      ring: 'ring-green-500/20'
    },
    inactive: {
      bg: isDarkMode ? 'bg-red-900/50' : 'bg-red-100',
      text: isDarkMode ? 'text-red-400' : 'text-red-700',
      dot: 'bg-red-500',
      ring: 'ring-red-500/20'
    },
    'on leave': {
      bg: isDarkMode ? 'bg-yellow-900/50' : 'bg-yellow-100',
      text: isDarkMode ? 'text-yellow-400' : 'text-yellow-700',
      dot: 'bg-yellow-500',
      ring: 'ring-yellow-500/20'
    },
    pending: {
      bg: isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100',
      text: isDarkMode ? 'text-gray-400' : 'text-gray-700',
      dot: 'bg-gray-500',
      ring: 'ring-gray-500/20'
    }
  };
  return configs[status?.toLowerCase()] || configs.pending;
};

const getPerformanceColor = (performance, isDarkMode) => {
  if (performance >= 4.5) return isDarkMode ? 'text-green-400' : 'text-green-600';
  if (performance >= 3.5) return isDarkMode ? 'text-blue-400' : 'text-blue-600';
  if (performance >= 2.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  return isDarkMode ? 'text-red-400' : 'text-red-600';
};

const EmployeeCard = memo(({ employee, onViewDetails, onEdit, onDelete, onPhotoUpdate, style }) => {
  const { t } = useLanguage();
  const { isDarkMode, _bg, _text, _border } = useTheme();
  const { user } = useAuth();
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Check if user has permission to edit/delete (not employee role)
  const canEditOrDelete = user?.role !== 'employee';

  // Memoize status config
  const statusConfig = useMemo(() => getStatusConfig(employee.status, isDarkMode), [employee.status, isDarkMode]);

  // Memoize performance color
  const performanceColor = useMemo(() => getPerformanceColor(employee.performance, isDarkMode), [employee.performance, isDarkMode]);

  // Memoize avatar style to prevent recreation
  const avatarStyle = useMemo(() => ({
    borderColor: isDarkMode ? '#3b82f6' : '#2563eb',
  }), [isDarkMode]);

  const handlePhotoUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert(t('errors.invalidFileType', 'Please select an image file'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('errors.fileTooLarge', 'File size must be less than 5MB'));
      return;
    }

    if (onPhotoUpdate) {
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const result = await onPhotoUpdate(employee.id, reader.result, true); // true = use storage
          if (result?.success) {
            setPhotoError(false);
          }
          setUploading(false);
        };
        reader.onerror = () => {
          alert(t('errors.fileReadError', 'Error reading file'));
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Photo upload error:', error);
        setUploading(false);
      }
    }
  }, [employee?.id, onPhotoUpdate, t]);

  // Memoize click handlers
  const handleCardClick = useCallback(() => {
    onViewDetails && onViewDetails(employee);
  }, [onViewDetails, employee]);

  const handleViewClick = useCallback((e) => {
    e.stopPropagation();
    onViewDetails(employee);
  }, [onViewDetails, employee]);

  const handleEditClick = useCallback((e) => {
    e.stopPropagation();
    onEdit && onEdit(employee);
  }, [onEdit, employee]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    onDelete && onDelete(employee);
  }, [onDelete, employee]);

  return (
    <div
      className={`rounded-xl shadow-sm border transition-all duration-300 cursor-pointer overflow-hidden ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } ${isHovered ? 'shadow-xl -translate-y-2 scale-[1.02]' : 'hover:shadow-lg hover:-translate-y-1'}`}
      style={style}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with gradient background */}
      <div className={`relative h-20 ${isDarkMode ? 'bg-linear-to-r from-blue-900 to-purple-900' : 'bg-linear-to-r from-blue-500 to-purple-500'}`}>
        {/* Status indicator */}
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 ${statusConfig.bg} ${statusConfig.text} ring-2 ${statusConfig.ring}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} animate-pulse`}></span>
          <span>{t(`employeeStatus.${employee.status.toLowerCase().replace(' ', '')}`, employee.status)}</span>
        </div>
      </div>

      {/* Avatar overlapping header */}
      <div className="relative px-4 -mt-10">
        <div className="relative group/avatar inline-block">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all shadow-lg ${
              isDarkMode ? 'bg-gray-700 border-gray-800' : 'bg-gray-100 border-white'
            }`}
            style={avatarStyle}
          >
            {uploading ? (
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            ) : employee.photo && !photoError ? (
              <img
                src={employee.photo}
                alt={employee.name}
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <User className={`w-10 h-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            )}
          </div>
          {!uploading && canEditOrDelete && (
            <label
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
              title={t('employees.uploadPhoto', 'Upload photo')}
              onClick={(e) => e.stopPropagation()}
            >
              <Camera className="w-6 h-6 text-white" />
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-4">
        {/* Name and Position */}
        <div className="mb-4">
          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {getDemoEmployeeName(employee, t)}
          </h3>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {t(`employeePosition.${employee.position.toLowerCase().replace(' ', '')}`, employee.position)}
          </p>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`flex items-center space-x-2 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <Network className={`h-4 w-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t(`employeeDepartment.${employee.department.toLowerCase().replace(' ', '')}`, employee.department)}
            </span>
          </div>
          <div className={`flex items-center space-x-2 p-2 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <TrendingUp className={`h-4 w-4 ${performanceColor}`} />
            <span className={`text-xs font-semibold ${performanceColor}`}>
              {employee.performance}/5.0
            </span>
          </div>
        </div>

        {/* Contact Info */}
        <div className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <div className="flex items-center space-x-2">
            <Mail className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <span className="truncate">{employee.email}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Phone className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <span>{employee.phone}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className={`h-4 w-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <span className="truncate">{employee.address ? employee.address.toLocaleString() : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className={`flex items-center justify-between px-4 py-3 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
        <div className="flex items-center space-x-1">
          <button
            type = "button"
            onClick={handleViewClick}
            className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-blue-400' : 'hover:bg-gray-200 text-gray-500 hover:text-blue-600'
            }`}
            title={t('employees.view', 'View Details')}
          >
            <Eye className="h-4 w-4" />
          </button>
          {canEditOrDelete && (
            <>
              <button
                type = "button"
                onClick={handleEditClick}
                className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-green-400' : 'hover:bg-gray-200 text-gray-500 hover:text-green-600'
                }`}
                title={t('employees.edit', 'Edit')}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type = "button"
                onClick={handleDeleteClick}
                className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-200 text-gray-500 hover:text-red-600'
                }`}
                title={t('employees.delete', 'Delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <button
          type = "button"
          onClick={handleViewClick}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            isDarkMode
              ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-800'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          <span>{t('common.viewDetails', 'View')}</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

EmployeeCard.displayName = 'EmployeeCard';

export default EmployeeCard;
