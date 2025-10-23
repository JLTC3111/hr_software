import React, { useState, useCallback, useEffect } from 'react'
import { X, User } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'

const AddEmployeeModal = ({ isOpen, onClose, onAddEmployee }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    department: '',
    email: '',
    dob: '',
    address: '',
    phone: '',
    startDate: '',
    status: 'Active',
    performance: '3.0'
  });

  const [errors, setErrors] = useState({});

  // Reset form when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        position: '',
        department: '',
        email: '',
        dob: '',
        address: '',
        phone: '',
        startDate: '',
        status: 'Active',
        performance: '3.0'
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
    
    if (!formData.name.trim()) newErrors.name = t('addEmployee.nameRequired', 'Name is required');
    if (!formData.position.trim()) newErrors.position = t('addEmployee.positionRequired', 'Position is required');
    if (!formData.department.trim()) newErrors.department = t('addEmployee.departmentRequired', 'Department is required');
    if (!formData.email.trim()) {
      newErrors.email = t('addEmployee.emailRequired', 'Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('addEmployee.emailInvalid', 'Email is invalid');
    }
    if (!formData.phone.trim()) newErrors.phone = t('addEmployee.phoneRequired', 'Phone is required');
    if (!formData.dob) newErrors.dob = t('addEmployee.dobRequired', 'Date of birth is required');
    if (!formData.address.trim()) newErrors.address = t('addEmployee.addressRequired', 'Address is required');
    if (!formData.startDate) newErrors.startDate = t('addEmployee.startDateRequired', 'Start date is required');
    
    const performance = parseFloat(formData.performance);
    if (isNaN(performance) || performance < 0 || performance > 5) {
      newErrors.performance = t('addEmployee.performanceInvalid', 'Performance must be between 0 and 5');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      const newEmployee = {
        name: formData.name,
        position: formData.position,
        department: formData.department,
        email: formData.email,
        dob: formData.dob,
        address: formData.address,
        phone: formData.phone,
        startDate: formData.startDate,
        status: formData.status,
        performance: parseFloat(formData.performance),
        photo: null // Default to no photo, user can upload later
      };
      
      await onAddEmployee(newEmployee);
      onClose();
    }
  };

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Always render, but return null content if not open
  // This ensures hooks are always called in the same order
  return !isOpen ? null : (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={handleCancel}>
      <div 
        className={`rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-left mb-6">
            <h3 className="text-2xl font-bold">
              {t('addEmployee.title', 'Add New Employee')}
            </h3>
            <button
              onClick={handleCancel}
              className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('employees.name', 'Name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${errors.name ? 'border-red-500' : ''}`}
                placeholder={t('addEmployee.namePlaceholder', 'Enter employee name')}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('employees.position', 'Position')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${errors.position ? 'border-red-500' : ''}`}
                placeholder={t('addEmployee.positionPlaceholder', 'e.g., senior_developer')}
              />
              {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('employees.department', 'Department')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${errors.department ? 'border-red-500' : ''}`}
                placeholder={t('addEmployee.departmentPlaceholder', 'e.g., engineering, finance')}
              />
              {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
            </div>

            {/* Email and Phone - Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employees.email', 'Email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  } ${errors.email ? 'border-red-500' : ''}`}
                  placeholder={t('addEmployee.emailPlaceholder', 'employee@example.com')}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employees.phone', 'Phone')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  } ${errors.phone ? 'border-red-500' : ''}`}
                  placeholder={t('addEmployee.phonePlaceholder', '+84 909 999 999')}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* DOB and Start Date - Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('addEmployee.dob', 'Date of Birth')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  } ${errors.dob ? 'border-red-500' : ''}`}
                />
                {errors.dob && <p className="text-red-500 text-sm mt-1">{errors.dob}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employees.startDate', 'Start Date')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  } ${errors.startDate ? 'border-red-500' : ''}`}
                />
                {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('addEmployee.address', 'Address')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                } ${errors.address ? 'border-red-500' : ''}`}
                placeholder={t('addEmployee.addressPlaceholder', 'City, Country')}
              />
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
            </div>

            {/* Status and Performance - Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employees.status', 'Status')}
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="Active">{t('employeeStatus.active', 'Active')}</option>
                  <option value="Inactive">{t('employeeStatus.inactive', 'Inactive')}</option>
                  <option value="onLeave">{t('employeeStatus.onleave', 'On Leave')}</option>
                  <option value="pending">{t('employeeStatus.pending', 'Pending')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('employees.performance', 'Performance')} (0-5)
                </label>
                <input
                  type="number"
                  name="performance"
                  value={formData.performance}
                  onChange={handleChange}
                  min="0"
                  max="5"
                  step="0.1"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  } ${errors.performance ? 'border-red-500' : ''}`}
                />
                {errors.performance && <p className="text-red-500 text-sm mt-1">{errors.performance}</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {t('addEmployee.submit', 'Add Employee')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEmployeeModal;
