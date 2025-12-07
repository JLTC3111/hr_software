import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Mail, Award, User, Camera, Cake, Network, Loader, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getEmployeeByUserId, updateEmployee } from '../services/employeeService';
import { supabase } from '../config/supabaseClient';
import { isDemoMode } from '../utils/demoHelper';

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
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

const UserEmployeeCard = ({ style }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch employee data on mount
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user?.id) {
        setError('No user logged in');
        setLoading(false);
        return;
      }

      try {
        const result = await getEmployeeByUserId(user.id);
        
        if (result.success) {
          setEmployee(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to load employee data');
        }
      } catch (err) {
        console.error('Error fetching employee data:', err);
        setError('An error occurred while loading your profile');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [user?.id]);

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
    
    setUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result;
        
        try {
          // Update employee photo
          const updateResult = await updateEmployee(employee.id, { photo: base64Data });
          
          if (updateResult.success) {
            setEmployee(prev => ({ ...prev, photo: base64Data }));
            
            // Also update user avatar_url in hr_users table
            if (!isDemoMode()) {
              await supabase
                .from('hr_users')
                .update({ avatar_url: base64Data })
                .eq('id', user.id);
            }
              
            setPhotoError(false);
            alert(t('employees.photoUpdated', 'Photo updated successfully!'));
          } else {
            alert(t('employees.photoUpdateError', 'Failed to update photo'));
          }
        } catch (error) {
          console.error('Photo update error:', error);
          alert(t('employees.photoUpdateError', 'Failed to update photo'));
        } finally {
          setUploading(false);
        }
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
  };

  // Show loading state
  if (loading) {
    return (
      <div 
        className="rounded-lg shadow-sm border p-6 flex items-center justify-center"
        style={style}
      >
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3">{t('common.loading', 'Loading...')}</span>
      </div>
    );
  }

  // Show error state
  if (error || !employee) {
    return (
      <div 
        className="rounded-lg shadow-sm border p-6"
        style={style}
      >
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-2" style={{ color: style?.color }}>
              {t('employees.profileNotLinked', 'Profile Not Linked')}
            </h3>
            <p className="text-sm opacity-70" style={{ color: style?.color }}>
              {error || t('employees.noEmployeeRecord', 'No employee record found for your account. Please contact HR to link your profile.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show employee card
  return (
    <div 
      className="rounded-lg shadow-sm border transition-all duration-300 slide-in-up" 
      style={style}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative group/avatar">
              <div 
                className={`w-16 h-16 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full flex items-center justify-center overflow-hidden border-2 transition-all`}
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
                  <User className="w-8 h-8 text-gray-400" />
                )}
              </div>
              {!uploading && (
                <label 
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                  title={t('employees.uploadPhoto', 'Upload photo')}
                >
                  <Camera className="w-5 h-5 text-white" />
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
              <h3 className="text-lg font-semibold" style={{ color: style?.color }}>
                {employee.name}
              </h3>
              <p className="text-sm opacity-70" style={{ color: style?.color }}>
                {t(`employeePosition.${employee.position?.toLowerCase().replace(' ', '')}`, employee.position)}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(employee.status)}`}>
            {t(`employeeStatus.${employee.status?.toLowerCase().replace(' ', '')}`, employee.status)}
          </span>
        </div>
        
        <div className="space-y-2 text-sm" style={{ color: style?.color, opacity: 0.8 }}>
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>{t(`employeeDepartment.${employee.department?.toLowerCase().replace(' ', '')}`, employee.department)}</span>
          </div>
          {employee.dob && (
            <div className="flex items-center space-x-2">
              <Cake className="h-4 w-4" />
              <span>{employee.dob}</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>{employee.email}</span>
          </div>
          {employee.phone && (
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>{employee.phone}</span>
            </div>
          )}
          {employee.address && (
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>{employee.address}</span>
            </div>
          )}
          {employee.performance && (
            <div className="flex items-center space-x-2">
              <Award className="h-4 w-4" />
              <span>{t('employees.performance')}: {employee.performance}/5.0</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserEmployeeCard;
