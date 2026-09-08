import _React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Mail, Phone, MapPin, Briefcase, Calendar, Award, Edit2, Save, X, User } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import * as employeeService from '../services/employeeService.js'
import { DatePicker } from './ui/date-picker.jsx'
import { getIndustry, DISPLAY, BODY, figure } from '../theme/industry.js'
import { Blueprint, Btn, Tag, Kicker, ColumnHeading, FlatListbox } from './ui/industry.jsx'
import { AutofillOffInput, AUTOFILL_OFF_FORM_ATTRS, cloakAutofillLabel } from '../hooks/useSuppressAutofill.jsx'

const EmployeeModal = ({ employee, onClose, onUpdate, initialEditMode = false }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = useMemo(() => getIndustry(isDarkMode), [isDarkMode]);
  const { user, handleSessionAuthError } = useAuth();
  
  // Check if user has permission to edit (not employee role)
  const canEdit = user?.role !== 'employee';
  
  const [isEditing, setIsEditing] = useState(initialEditMode && canEdit);
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
    { value: 'expertGroup', label: t('employeePosition.expertGroup', 'Experts Group') },
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
        alert(t('employees.updateSuccess', 'Employee details have been successfully updated!'));
      } else {
        console.error('Failed to update employee:', result.error);
        alert(t('employees.updateError', 'Failed to update employee'));
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      if (handleSessionAuthError(error)) return;
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

  if (!employee || !currentEmployee) return null;

  const statusKey = String(currentEmployee.status || formData.status || 'Active').toLowerCase().replace(/\s+/g, '');
  const statusVariant = statusKey === 'inactive' ? 'outline' : statusKey === 'onleave' ? 'neutral' : 'accent';
  const field = (invalid) => ({
    width: '100%',
    fontFamily: BODY,
    fontSize: 13,
    color: ind.ink,
    background: 'transparent',
    border: `1px solid ${invalid ? ind.ink : ind.hairline}`,
    borderRadius: 0,
    padding: '7px 10px',
    outline: 'none',
  });
  const fieldError = {
    fontFamily: BODY, fontSize: 11.5, color: ind.ink, marginTop: 4,
    borderLeft: `2px solid ${ind.ink}`, paddingLeft: 6,
  };
  const label = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 10, letterSpacing: '.14em',
    textTransform: 'uppercase', color: ind.inkMuted, display: 'block', marginBottom: 5,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(29,31,32,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <Blueprint
        ind={ind}
        style={{
          background: ind.ground, width: '100%', maxWidth: 672, maxHeight: '90vh',
          overflowY: 'auto', color: ind.ink, fontFamily: BODY,
        }}
      >
        <form
          {...AUTOFILL_OFF_FORM_ATTRS}
          onSubmit={(event) => event.preventDefault()}
          style={{ padding: '18px 20px 16px' }}
        >
          <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 18 }}>
            <ColumnHeading ind={ind}>
              {isEditing ? t('employees.editEmployee', 'Edit Employee') : t('employees.employeeDetails', 'Employee Details')}
            </ColumnHeading>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: ind.inkMuted, padding: 0 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center" style={{ gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 64, height: 64, flex: 'none', overflow: 'hidden',
                border: `1px solid ${ind.hairline}`,
                background: currentEmployee?.photo ? 'transparent' : ind.accentWash,
                display: 'grid', placeItems: 'center',
              }}
            >
              {currentEmployee?.photo ? (
                <img src={currentEmployee.photo} alt={currentEmployee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={22} strokeWidth={1.5} style={{ color: ind.inkMuted }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditing ? (
                <div>
                  <AutofillOffInput type="text" name="name" value={formData.name} onChange={handleChange} aria-label={t('employees.name', 'Name')} style={field(errors.name)} />
                  {errors.name && <p style={fieldError}>{errors.name}</p>}
                </div>
              ) : (
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {currentEmployee?.name || 'N/A'}
                </div>
              )}

              {isEditing ? (
                <div style={{ marginTop: 8 }}>
                  <FlatListbox
                    ind={ind}
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    aria-label={t('employees.position', 'Position')}
                    style={{ width: '100%', padding: '8px 10px', textTransform: 'none', letterSpacing: '.02em', border: `1px solid ${errors.position ? ind.ink : ind.hairline}` }}
                  >
                    <option value="">{t('addEmployee.selectPosition', 'Select Position')}</option>
                    {positions.map((pos) => (
                      <option key={pos.value} value={pos.value}>{pos.label}</option>
                    ))}
                  </FlatListbox>
                  {errors.position && <p style={fieldError}>{errors.position}</p>}
                </div>
              ) : (
                <p style={{ fontFamily: BODY, fontSize: 13, color: ind.inkMuted, marginTop: 4 }}>
                  {formData.position ? t(`employeePosition.${formData.position}`, currentEmployee?.position) : 'N/A'}
                </p>
              )}

              {isEditing ? (
                <div style={{ marginTop: 8 }}>
                  <FlatListbox
                    ind={ind}
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    aria-label={t('employees.status', 'Status')}
                    style={{ width: '100%', padding: '6px 10px', textTransform: 'none', letterSpacing: '.02em' }}
                  >
                    <option value="Active">{t('employeeStatus.active', 'Active')}</option>
                    <option value="Inactive">{t('employeeStatus.inactive', 'Inactive')}</option>
                    <option value="On Leave">{t('employeeStatus.onLeave', 'On Leave')}</option>
                  </FlatListbox>
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <Tag ind={ind} variant={statusVariant}>
                    {t(`employeeStatus.${statusKey}`, currentEmployee?.status || 'Active')}
                  </Tag>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24 }}>
            <div>
              <Kicker ind={ind} color={ind.ink} style={{ marginBottom: 12 }}>{t('employees.contactInformation', 'Contact Information')}</Kicker>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={label}><Mail size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{cloakAutofillLabel(t('employees.email', 'Email'))}</span>
                  {isEditing ? (
                    <div>
                      <AutofillOffInput type="text" name="email" value={formData.email} onChange={handleChange} aria-label={t('employees.email', 'Email')} style={field(errors.email)} />
                      {errors.email && <p style={fieldError}>{errors.email}</p>}
                    </div>
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>{currentEmployee?.email || 'N/A'}</span>
                  )}
                </div>
                <div>
                  <span style={label}><Phone size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{cloakAutofillLabel(t('employees.phone', 'Phone'))}</span>
                  {isEditing ? (
                    <div>
                      <AutofillOffInput type="text" name="phone" value={formData.phone} onChange={handleChange} aria-label={t('employees.phone', 'Phone')} style={field(errors.phone)} />
                      {errors.phone && <p style={fieldError}>{errors.phone}</p>}
                    </div>
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>{currentEmployee?.phone || 'N/A'}</span>
                  )}
                </div>
                <div>
                  <span style={label}><MapPin size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{cloakAutofillLabel(t('addEmployee.address', 'Address'))}</span>
                  {isEditing ? (
                    <AutofillOffInput type="text" name="address" value={formData.address} onChange={handleChange} aria-label={t('addEmployee.address', 'Address')} style={field(false)} />
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>{currentEmployee.address || currentEmployee.location || 'N/A'}</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Kicker ind={ind} color={ind.ink} style={{ marginBottom: 12 }}>{t('employees.employmentDetails', 'Employment Details')}</Kicker>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={label}><Briefcase size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{t('employees.department', 'Department')}</span>
                  {isEditing ? (
                    <div>
                      <FlatListbox
                        ind={ind}
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        aria-label={t('employees.department', 'Department')}
                        style={{ width: '100%', padding: '8px 10px', textTransform: 'none', letterSpacing: '.02em', border: `1px solid ${errors.department ? ind.ink : ind.hairline}` }}
                      >
                        <option value="">{t('addEmployee.selectDepartment', 'Select Department')}</option>
                        {departments.map((dept) => (
                          <option key={dept.value} value={dept.value}>{dept.label}</option>
                        ))}
                      </FlatListbox>
                      {errors.department && <p style={fieldError}>{errors.department}</p>}
                    </div>
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>
                      {formData.department ? t(`departments.${formData.department}`, currentEmployee?.department) : 'N/A'}
                    </span>
                  )}
                </div>
                <div>
                  <span style={label}><Calendar size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{t('employees.startDate', 'Start Date')}</span>
                  {isEditing ? (
                    <DatePicker flat name="startDate" value={formData.startDate} onChange={handleChange} icon={Calendar} />
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>{currentEmployee.startDate || currentEmployee.start_date || 'N/A'}</span>
                  )}
                </div>
                <div>
                  <span style={label}><Calendar size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{t('addEmployee.dob', 'Date of Birth')}</span>
                  {isEditing ? (
                    <DatePicker flat name="dob" value={formData.dob} onChange={handleChange} icon={Calendar} />
                  ) : (
                    <span style={{ fontFamily: BODY, fontSize: 13 }}>{currentEmployee?.dob || 'N/A'}</span>
                  )}
                </div>
                <div>
                  <span style={label}><Award size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{t('employees.performance', 'Performance')}</span>
                  {isEditing ? (
                    <div>
                      <input type="number" name="performance" value={formData.performance} onChange={handleChange} min="0" max="5" step="0.1" placeholder="3.5" style={field(errors.performance)} />
                      {errors.performance && <p style={fieldError}>{errors.performance}</p>}
                    </div>
                  ) : (
                    <span style={figure(14, ind.ink)}>{currentEmployee?.performance || 'N/A'}/5.0</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end" style={{ gap: 10, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${ind.hairline}` }}>
            {isEditing ? (
              <>
                <Btn ind={ind} onClick={handleCancel} disabled={isSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <X size={13} strokeWidth={1.5} />
                  {t('common.cancel', 'Cancel')}
                </Btn>
                <Btn ind={ind} variant="primary" onClick={handleSave} disabled={isSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Save size={13} strokeWidth={1.5} />
                  {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Btn>
              </>
            ) : (
              <>
                <Btn ind={ind} onClick={onClose}>{t('common.close', 'Close')}</Btn>
                {canEdit && (
                  <Btn ind={ind} variant="primary" onClick={() => setIsEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Edit2 size={13} strokeWidth={1.5} />
                    {t('employees.editEmployee', 'Edit Employee')}
                  </Btn>
                )}
              </>
            )}
          </div>
        </form>
      </Blueprint>
    </div>
  );
};

export default EmployeeModal;
