import React, { useState, useCallback, useMemo } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, Building2, DollarSign, Save, X, Upload, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import * as employeeService from '../services/employeeService';

// InputField component outside to prevent recreation
const InputField = React.memo(({ name, label, icon: Icon, type = 'text', required, value, onChange, error, touched, textSecondary, bgPrimary, textPrimary, borderPrimary, ...props }) => (
  <div>
    <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && <Icon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${textSecondary}`} />}
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2 ${bgPrimary} ${textPrimary} border ${error && touched ? 'border-red-500' : borderPrimary} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none`}
        {...props}
      />
    </div>
    {error && touched && (
      <p className="text-red-500 text-sm mt-1">{error}</p>
    )}
  </div>
));

InputField.displayName = 'InputField';

const AddNewEmployee = ({ refetchEmployees }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { createNotification } = useNotifications();
  const { isDarkMode, bg, text, border, hover } = useTheme();
  const { checkPermission } = useAuth();
  
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Check permission
  const canManageEmployees = checkPermission('canManageEmployees');
  
  // If user doesn't have permission, show access denied
  if (!canManageEmployees) {
    return (
      <div className={`min-h-screen ${bg.primary} flex items-center justify-center p-4`}>
        <div className={`${bg.secondary} rounded-lg shadow-lg border ${border.primary} p-8 max-w-md w-full text-center`}>
          <AlertCircle className={`w-16 h-16 ${isDarkMode ? 'text-red-400' : 'text-red-600'} mx-auto mb-4`} />
          <h2 className={`text-2xl font-bold ${text.primary} mb-2`}>
            {t('common.accessDenied', 'Access Denied')}
          </h2>
          <p className={`${text.secondary} mb-6`}>
            {t('common.noPermission', 'You do not have permission to access this page.')}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.goBack', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }
  
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', dob: '', address: '', photo: null,
    position: '', department: '', startDate: '', employmentStatus: 'active',
    salary: '', status: 'Active', performance: 3.0
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const steps = [
    { number: 1, title: t('addEmployee.personalInfo', 'Personal Info'), icon: User },
    { number: 2, title: t('addEmployee.employmentInfo', 'Employment'), icon: Briefcase },
    { number: 3, title: t('addEmployee.review', 'Review'), icon: Check }
  ];

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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    // Clear error for this field without depending on errors state
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []); // No dependencies - function is stable

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024 && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t('addEmployee.nameRequired');
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = t('addEmployee.emailInvalid');
    if (!formData.phone.trim()) newErrors.phone = t('addEmployee.phoneRequired');
    if (!formData.dob) newErrors.dob = t('addEmployee.dobRequired');
    if (!formData.address.trim()) newErrors.address = t('addEmployee.addressRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.position) newErrors.position = t('addEmployee.positionRequired');
    if (!formData.department) newErrors.department = t('addEmployee.departmentRequired');
    if (!formData.startDate) newErrors.startDate = t('addEmployee.startDateRequired');
    if (!formData.salary || parseFloat(formData.salary) <= 0) newErrors.salary = t('addEmployee.salaryRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => step > 1 && setStep(step - 1);

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2()) {
      setErrors({ submit: 'Please fill in all required fields correctly.' });
      return;
    }

    setSaving(true);
    
    try {
      // Create employee with properly formatted data
      const employeeData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob,
        address: formData.address.trim(),
        position: formData.position,
        department: formData.department,
        startDate: formData.startDate,
        status: formData.status || 'Active',
        performance: parseFloat(formData.performance) || 3.0,
        salary: parseFloat(formData.salary),
        photo: formData.photo
      };
      
      const result = await employeeService.createEmployee(employeeData);
      
      if (result.success) {
        // Create success notification
        try {
          await createNotification({
            userId: result.data.id,
            title: t('notifications.employeeAdded', 'Employee Added'),
            message: `${formData.name} ${t('notifications.addedTo', 'added to')} ${formData.department}`,
            type: 'success',
            category: 'employee'
          });
        } catch (notifError) {
          console.error('Notification error:', notifError);
          // Continue even if notification fails
        }
        
        // Refetch employees list to include the new employee
        if (refetchEmployees) {
          await refetchEmployees();
        }
        
        // Navigate back to employees page
        navigate('/employees');
      } else {
        setErrors({ submit: result.error || 'Failed to create employee. Please try again.' });
        console.error('Error creating employee:', result.error);
      }
    } catch (error) {
      setErrors({ submit: error.message || 'An unexpected error occurred.' });
      console.error('Unexpected error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-screen ${bg.primary} p-4 md:p-8`}>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/employees')} className={`flex items-center space-x-2 ${text.secondary} ${hover.bg} px-4 py-2 rounded-lg mb-6`}>
          <ArrowLeft className="h-4 w-4" />
          <span>{t('common.back', 'Back')}</span>
        </button>

        {/* Progress */}
        <div className={`${bg.secondary} rounded-lg shadow border ${border.primary} p-6 mb-6`}>
          <div className="flex items-center justify-between">
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = step === s.number;
              const isCompleted = step > s.number;
              return (
                <React.Fragment key={s.number}>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isActive ? 'bg-blue-600 border-blue-600 text-white' : isCompleted ? 'bg-green-600 border-green-600 text-white' : `border-gray-300 ${text.secondary}`}`}>
                      {isCompleted ? <Check className="h-6 w-6" /> : <StepIcon className="h-6 w-6" />}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isActive ? 'text-blue-600' : text.secondary}`}>{s.title}</span>
                  </div>
                  {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-4 mt-6 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className={`${bg.secondary} rounded-lg shadow border ${border.primary} p-6`}>
          {step === 1 && (
            <div className="space-y-6">
              <h2 className={`text-2xl font-bold ${text.primary}`}>{t('addEmployee.personalInformation', 'Personal Information')}</h2>
              <div className="flex flex-col items-center mb-6">
                <div className={`w-32 h-32 rounded-full ${bg.primary} border-2 ${border.primary} flex items-center justify-center overflow-hidden relative`}>
                  {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" /> : <User className={`h-0 w-0 ${text.secondary}`} />}
                  <label className={`absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white' : 'text-gray-700'} p-2 rounded-full cursor-pointer ${photoPreview ? 'hidden' : ''}`}>
                    <Upload className="h-10 w-10" />
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <InputField 
                name="name" 
                label={t('employees.name')} 
                placeholder={t('employees.namePlaceholder', 'Enter employee name')}
                icon={User} 
                required 
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                touched={touched.name}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
              <InputField 
                name="email" 
                label={t('employees.email')} 
                placeholder={t('employees.emailPlaceholder', 'Enter employee email')}
                type="email" 
                icon={Mail} 
                required 
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                touched={touched.email}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
              <InputField 
                name="phone" 
                label={t('employees.phone')} 
                placeholder={t('employees.phonePlaceholder', 'Enter employee phone')}
                type="tel" 
                icon={Phone} 
                required 
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                touched={touched.phone}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
              <InputField 
                name="dob" 
                label={t('addEmployee.dob')} 
                placeholder={t('addEmployee.dobPlaceholder', 'Enter employee dob')}
                type="date" 
                icon={Calendar} 
                required 
                value={formData.dob}
                onChange={handleChange}
                error={errors.dob}
                touched={touched.dob}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>{t('addEmployee.address')} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin className={`absolute left-3 top-3 h-5 w-5 ${text.secondary}`} />
                  <textarea 
                    name="address" 
                    placeholder={t('employees.addressPlaceholder', 'Enter employee address')}
                    value={formData.address || ''} 
                    onChange={handleChange} 
                    rows="3" 
                    className={`w-full pl-10 pr-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none`} 
                  />
                </div>
                {errors.address && touched.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className={`text-2xl font-bold ${text.primary}`}>{t('addEmployee.employmentInformation', 'Employment Information')}</h2>
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>{t('employees.position')} *</label>
                <div className="relative">
                  <Briefcase className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${text.secondary}`} />
                  <select name="position" value={formData.position} onChange={handleChange} className={`w-full pl-10 pr-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg`}>
                    <option value="">Select Position</option>
                    {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
              </div>
              <div>
                <label className={`block text-sm font-medium ${text.secondary} mb-2`}>{t('employees.department')} *</label>
                <div className="relative">
                  <Building2 className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${text.secondary}`} />
                  <select name="department" value={formData.department} onChange={handleChange} className={`w-full pl-10 pr-4 py-2 ${bg.primary} ${text.primary} border ${border.primary} rounded-lg`}>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
              </div>
              <InputField 
                name="startDate" 
                label={t('employees.startDate')} 
                placeholder={t('employees.startDatePlaceholder', 'Enter employee start date')}
                type="date" 
                icon={Calendar} 
                required 
                value={formData.startDate}
                onChange={handleChange}
                error={errors.startDate}
                touched={touched.startDate}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
              <InputField 
                name="salary" 
                label={t('employees.salary')} 
                placeholder={t('employees.salaryPlaceholder', 'Enter employee salary')}
                type="number" 
                icon={DollarSign} 
                min="0" 
                step="1000" 
                required 
                value={formData.salary}
                onChange={handleChange}
                error={errors.salary}
                touched={touched.salary}
                textSecondary={text.secondary}
                bgPrimary={bg.primary}
                textPrimary={text.primary}
                borderPrimary={border.primary}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className={`text-2xl font-bold ${text.primary}`}>{t('addEmployee.reviewAndSubmit', 'Review & Submit')}</h2>
              <div className={`${bg.primary} rounded-lg p-6`}>
                <div className="flex items-center space-x-4 mb-6">
                  {photoPreview ? <img src={photoPreview} alt={formData.name} className="w-20 h-20 rounded-full object-cover" /> : <div className={`w-20 h-20 rounded-full ${bg.secondary} flex items-center justify-center`}><User className={`h-10 w-10 ${text.secondary}`} /></div>}
                  <div>
                    <h3 className={`text-xl font-bold ${text.primary}`}>{formData.name}</h3>
                    <p className={text.secondary}>{positions.find(p => p.value === formData.position)?.label}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className={`text-sm ${text.secondary}`}>Email</p><p className={text.primary}>{formData.email}</p></div>
                  <div><p className={`text-sm ${text.secondary}`}>Phone</p><p className={text.primary}>{formData.phone}</p></div>
                  <div><p className={`text-sm ${text.secondary}`}>Department</p><p className={text.primary}>{departments.find(d => d.value === formData.department)?.label}</p></div>
                  <div><p className={`text-sm ${text.secondary}`}>Salary</p><p className={text.primary}>${parseFloat(formData.salary).toLocaleString()}</p></div>
                </div>
              </div>
              {errors.submit && <div className="bg-red-100 border border-red-500 text-red-700 px-4 py-3 rounded flex items-start space-x-2"><AlertCircle className="h-5 w-5" /><span>{errors.submit}</span></div>}
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <button onClick={step === 1 ? () => navigate('/employees') : handleBack} className={`px-6 py-2 rounded-lg border-2 ${border.primary} ${text.primary} ${hover.bg} font-medium transition-all hover:scale-105 hover:shadow-md`}>
              <X className="h-4 w-4 inline mr-2" />
              {step === 1 ? t('common.cancel') : t('common.back')}
            </button>
            {step < 3 ? (
              <button onClick={handleNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('common.next', 'Next')}</button>
            ) : (
              <button onClick={handleSubmit} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? <span>Saving...</span> : <><Save className="h-4 w-4 inline mr-2" />{t('common.submit', 'Submit')}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddNewEmployee;
