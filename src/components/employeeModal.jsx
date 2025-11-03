import React, { useState, useCallback, useEffect } from 'react'
import { Mail, Phone, MapPin, Briefcase, Calendar, Award, Edit2, Save, X, User } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'
import * as employeeService from '../services/employeeService'

const getStatusColor = (status) => {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-800'
    case 'Inactive':
      return 'bg-red-100 text-red-800'
    case 'On Leave':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const EmployeeModal = ({ employee, onClose, onUpdate, initialEditMode = false }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentEmployee, setCurrentEmployee] = useState(employee); // Track current employee data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    position: '',
    department: '',
    startDate: '',
    status: 'Active',
    performance: '',
    salary: '',
    dob: ''
  });

  const departments = [
    { value: 'legal_compliance', label: t('departments.legal_compliance', 'Legal Compliance') },
    { value: 'technology', label: t('departments.technology', 'Technology') },
    { value: 'internal_affairs', label: t('departments.internal_affairs', 'Internal Affairs') },
    { value: 'human_resources', label: t('departments.human_resources', 'Human Resources') },
    { value: 'office_unit', label: t('departments.office_unit', 'Office Unit') },
    { value: 'board_of_directors', label: t('departments.board_of_directors', 'Board of Directors') },
    { value: 'finance', label: t('departments.finance', 'Finance') },
    { value: 'engineering', label: t('departments.engineering', 'Engineering') },
    { value: 'sales', label: t('departments.sales', 'Sales') },
    { value: 'marketing', label: t('departments.marketing', 'Marketing') },
    { value: 'design', label: t('departments.design', 'Design') },
    { value: 'part_time_employee', label: t('departments.part_time_employee', 'Part-Time Employee') }
  ];

  const positions = [
    { value: 'general_manager', label: t('employeePosition.general_manager', 'General Manager') },
    { value: 'senior_developer', label: t('employeePosition.senior_developer', 'Senior Developer') },
    { value: 'hr_specialist', label: t('employeePosition.hr_specialist', 'HR Manager') },
    { value: 'accountant', label: t('employeePosition.accountant', 'Chief Accountant') },
    { value: 'contract_manager', label: t('employeePosition.contract_manager', 'Contract Manager') },
    { value: 'managing_director', label: t('employeePosition.managing_director', 'Managing Director') },
    { value: 'support_staff', label: t('employeePosition.support_staff', 'Support Staff') },
    { value: 'employee', label: t('employeePosition.employee', 'Employee') }
  ];

  // Initialize form data when employee changes
  useEffect(() => {
    if (employee) {
      setCurrentEmployee(employee);
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        address: employee.address || employee.location || '',
        position: employee.position || '',
        department: employee.department || '',
        startDate: employee.startDate || employee.start_date || '',
        status: employee.status || 'Active',
        performance: employee.performance || '',
        salary: employee.salary || '',
        dob: employee.dob || ''
      });
    }
  }, [employee]);

  // Handle initialEditMode changes
  useEffect(() => {
    setIsEditing(initialEditMode);
  }, [initialEditMode]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose, isSaving]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('addEmployee.nameRequired', 'Name is required');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('addEmployee.emailRequired', 'Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('addEmployee.emailInvalid', 'Email is invalid');
    }
    if (!formData.phone.trim()) {
      newErrors.phone = t('addEmployee.phoneRequired', 'Phone is required');
    }
    if (!formData.position.trim()) {
      newErrors.position = t('addEmployee.positionRequired', 'Position is required');
    }
    if (!formData.department.trim()) {
      newErrors.department = t('addEmployee.departmentRequired', 'Department is required');
    }
    
    if (formData.performance && (parseFloat(formData.performance) < 0 || parseFloat(formData.performance) > 5)) {
      newErrors.performance = t('addEmployee.performanceInvalid', 'Performance must be between 0 and 5');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        position: formData.position,
        department: formData.department,
        startDate: formData.startDate,
        status: formData.status,
        performance: formData.performance ? parseFloat(formData.performance) : null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        dob: formData.dob
      };

      const result = await employeeService.updateEmployee(employee.id, updates);
      
      if (result.success) {
        // Update current employee data with saved changes
        setCurrentEmployee(result.data);
        setIsEditing(false);
        if (onUpdate) {
          onUpdate(result.data);
        }
        alert(t('employees.updateSuccess', 'Employee updated successfully!'));
      } else {
        alert(t('employees.updateError', 'Failed to update employee: ') + result.error);
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      alert(t('employees.updateError', 'An error occurred while updating the employee.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original employee data
    if (employee) {
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        address: employee.address || employee.location || '',
        position: employee.position || '',
        department: employee.department || '',
        startDate: employee.startDate || employee.start_date || '',
        status: employee.status || 'Active',
        performance: employee.performance || '',
        salary: employee.salary || '',
        dob: employee.dob || ''
      });
    }
    setErrors({});
    setIsEditing(false);
  };

  if (!employee) return null;

  const bgColor = isDarkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-gray-700' : 'bg-white';
  const inputBorder = isDarkMode ? 'border-gray-600' : 'border-gray-300';

  // Guard clause: Don't render if no employee
  if (!employee || !currentEmployee) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div className={`${bgColor} rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto ${textPrimary}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <h3 className={`text-xl font-bold ${textPrimary}`}>
              {isEditing ? t('employees.editEmployee', 'Edit Employee') : t('employees.employeeDetails', 'Employee Details')}
            </h3>
            <button
              onClick={onClose}
              className={`${textSecondary} hover:${textPrimary}`}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${isDarkMode ? 'bg-gray-700' : 'bg-blue-100'} rounded-full flex items-center justify-center overflow-hidden border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                {currentEmployee?.photo ? (
                  <img 
                    src={currentEmployee.photo} 
                    alt={currentEmployee.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={currentEmployee?.photo ? 'hidden' : 'flex'} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <User className="w-8 h-8" style={{ color: isDarkMode ? '#ffffff' : '#000000' }} />
                </div>
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 ${inputBg} border ${errors.name ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                      placeholder={t('employees.name', 'Name')}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>
                ) : (
                  <h4 className={`text-lg font-semibold ${textPrimary}`}>{currentEmployee?.name || 'N/A'}</h4>
                )}
                
                {isEditing ? (
                  <div className="mt-2">
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 ${inputBg} border ${errors.position ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                    >
                      <option value="">{t('addEmployee.selectPosition', 'Select Position')}</option>
                      {positions.map(pos => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                    {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
                  </div>
                ) : (
                  <p className={textSecondary}>
                    {formData.position ? t(`employeePosition.${formData.position}`, currentEmployee?.position) : 'N/A'}
                  </p>
                )}
                
                {isEditing ? (
                  <div className="mt-2">
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className={`px-3 py-1 text-sm ${inputBg} border ${inputBorder} rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                    >
                      <option value="Active">{t('employeeStatus.active', 'Active')}</option>
                      <option value="Inactive">{t('employeeStatus.inactive', 'Inactive')}</option>
                      <option value="On Leave">{t('employeeStatus.onleave', 'On Leave')}</option>
                    </select>
                  </div>
                ) : (
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(currentEmployee?.status || 'Active')}`}>
                    {t(`employeeStatus.${(currentEmployee?.status || 'Active').toLowerCase().replace(' ', '')}`, currentEmployee?.status || 'Active')}
                  </span>
                )}
              </div>
            </div>
            
            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h5 className={`font-medium ${textPrimary}`}>{t('employees.contactInformation', 'Contact Information')}</h5>
                <div className="space-y-3 text-sm">
                  {/* Email */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Mail className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('employees.email', 'Email')}</span>
                    </div>
                    {isEditing ? (
                      <div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 ${inputBg} border ${errors.email ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                          placeholder="email@example.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>
                    ) : (
                      <span className={textPrimary}>{currentEmployee?.email || 'N/A'}</span>
                    )}
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Phone className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('employees.phone', 'Phone')}</span>
                    </div>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 ${inputBg} border ${errors.phone ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                          placeholder="+1 234 567 8900"
                        />
                        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                      </div>
                    ) : (
                      <span className={textPrimary}>{currentEmployee?.phone || 'N/A'}</span>
                    )}
                  </div>
                  
                  {/* Address */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <MapPin className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('addEmployee.address', 'Address')}</span>
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                        placeholder="City, Country"
                      />
                    ) : (
                      <span className={textPrimary}>{currentEmployee.address || currentEmployee.location || 'N/A'}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Employment Details */}
              <div className="space-y-4">
                <h5 className={`font-medium ${textPrimary}`}>{t('employees.employmentDetails', 'Employment Details')}</h5>
                <div className="space-y-3 text-sm">
                  {/* Department */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Briefcase className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('employees.department', 'Department')}</span>
                    </div>
                    {isEditing ? (
                      <div>
                        <select
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 ${inputBg} border ${errors.department ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                        >
                          <option value="">{t('addEmployee.selectDepartment', 'Select Department')}</option>
                          {departments.map(dept => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </select>
                        {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
                      </div>
                    ) : (
                      <span className={textPrimary}>
                        {formData.department ? t(`departments.${formData.department}`, currentEmployee?.department) : 'N/A'}
                      </span>
                    )}
                  </div>
                  
                  {/* Start Date */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Calendar className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('employees.startDate', 'Start Date')}</span>
                    </div>
                    {isEditing ? (
                      <div className="relative">
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 pr-10 ${inputBg} border ${inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                        />
                        <Calendar className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textSecondary} pointer-events-none`} />
                      </div>
                    ) : (
                      <span className={textPrimary}>{currentEmployee.startDate || currentEmployee.start_date || 'N/A'}</span>
                    )}
                  </div>
                  
                  {/* Date of Birth */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Calendar className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('addEmployee.dob', 'Date of Birth')}</span>
                    </div>
                    {isEditing ? (
                      <div className="relative">
                        <input
                          type="date"
                          name="dob"
                          value={formData.dob}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 pr-10 ${inputBg} border ${inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                        />
                        <Calendar className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${textSecondary} pointer-events-none`} />
                      </div>
                    ) : (
                      <span className={textPrimary}>{currentEmployee?.dob || 'N/A'}</span>
                    )}
                  </div>
                  
                  {/* Performance */}
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Award className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-xs ${textSecondary}`}>{t('employees.performance', 'Performance')}</span>
                    </div>
                    {isEditing ? (
                      <div>
                        <input
                          type="number"
                          name="performance"
                          value={formData.performance}
                          onChange={handleChange}
                          min="0"
                          max="5"
                          step="0.1"
                          className={`w-full px-3 py-2 ${inputBg} border ${errors.performance ? 'border-red-500' : inputBorder} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${textPrimary}`}
                          placeholder="3.5"
                        />
                        {errors.performance && <p className="text-red-500 text-xs mt-1">{errors.performance}</p>}
                      </div>
                    ) : (
                      <span className={textPrimary}>{currentEmployee?.performance || 'N/A'}/5.0</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className={`flex justify-end space-x-3 mt-8 pt-6 border-t ${borderColor}`}>
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className={`px-4 py-2 ${textSecondary} hover:${textPrimary} disabled:opacity-50`}
                >
                  <X className="h-4 w-4 inline mr-2" />
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className={`px-4 py-2 ${textSecondary} hover:${textPrimary}`}
                >
                  {t('common.close', 'Close')}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {t('employees.editEmployee', 'Edit Employee')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
