import React, { useState } from 'react'
import { Phone, MapPin, Mail, Award, Eye, Edit, Trash2, User, Camera, Cake, Network, Loader } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'

const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'inactive':
      return 'bg-red-100 text-red-800';
    case 'on leave':
      return 'bg-yellow-100 text-yellow-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const EmployeeCard = ({ employee, onViewDetails, onEdit, onDelete, onPhotoUpdate, style }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e) => {
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
  };
  
  return (
    <div 
      className="rounded-lg shadow-sm border hover:shadow-lg transition-all duration-300 hover:-translate-y-1 slide-in-up cursor-pointer" 
      style={style}
      onClick={() => onViewDetails && onViewDetails(employee)}
    >
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative group/avatar">
            <div 
              className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all"
              style={{
                borderColor: isDarkMode ? '#ffffff' : 'transparent',
                boxShadow: isDarkMode ? '0 0 0 2px rgba(255, 255, 255, 0.3)' : 'none'
              }}
            >
              {uploading ? (
                <Loader className="w-6 h-6 text-blue-600 animate-spin" />
              ) : employee.photo && !photoError ? (
                <img 
                  src={employee.photo} 
                  alt={employee.name}
                  className="w-full h-full object-cover"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <User className="w-6 h-6 text-gray-400" />
              )}
            </div>
            {!uploading && (
              <label 
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                title={t('employees.uploadPhoto', 'Upload photo')}
                onClick={(e) => e.stopPropagation()}
              >
                <Camera className="w-4 h-4 text-white" />
                <input 
                  type="file" 
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div>
            <h3 className="text-sm md:text-base font-semibold" style={{ color: style?.color }}>{employee.name}</h3>
            <p className="text-sm opacity-70" style={{ color: style?.color }}>{t(`employeePosition.${employee.position.toLowerCase().replace(' ', '')}`, employee.position)}</p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(employee.status)}`}>
          {t(`employeeStatus.${employee.status.toLowerCase().replace(' ', '')}`, employee.status)}
        </span>
      </div>
      
      <div className="space-y-2 text-sm" style={{ color: style?.color, opacity: 0.8 }}>
        <div className="flex items-center space-x-2">
          <Network className="h-4 w-4" />
          <span>{t(`employeeDepartment.${employee.department.toLowerCase().replace(' ', '')}`, employee.department)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Cake className="h-4 w-4" />
          <span>{employee.dob}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4" />
          <span>{employee.email}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Phone className="h-4 w-4" />
          <span>{employee.phone}</span>
        </div>
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4" />
          <span>{employee.address ? employee.address.toLocaleString() : 'N/A'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Award className="h-4 w-4" />
          <span>{t('employees.performance')}: {employee.performance}/5.0</span>
        </div>
      </div>
      
      <div className="flex justify-space-between space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(employee);
          }}
          className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
          title={t('employees.view', 'View Details')}
        >
          <Eye className="h-4 w-4" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit && onEdit(employee);
          }}
          className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
          title={t('employees.edit', 'Edit')}
        >
          <Edit className="h-4 w-4" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete && onDelete(employee);
          }}
          className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
          title={t('employees.delete', 'Delete')}
        >
          <Trash2 className="h-4 w-4" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
        </button>
      </div>
    </div>
  </div>
  );
};

export default EmployeeCard;
