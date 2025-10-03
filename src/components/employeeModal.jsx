import React from 'react'
import { Mail, Phone, MapPin, Briefcase, Calendar, DollarSign, Award } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

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

const EmployeeModal = ({ employee, onClose }) => {
  const { t } = useLanguage();
  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-gray-900">{t('employees.employeeDetails')}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-blue-600">{employee.avatar}</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{employee.name}</h4>
                <p className="text-gray-600">{employee.position}</p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(employee.status)}`}>
                  {t(`employeeStatus.${employee.status.toLowerCase().replace(' ', '')}`, employee.status)}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="font-medium text-gray-900">{t('employees.contactInformation')}</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{employee.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{employee.location}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h5 className="font-medium text-gray-900">{t('employees.employmentDetails')}</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    <span>{employee.department}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{t('employees.started')}: {employee.startDate}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span>${employee.salary.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="h-4 w-4 text-gray-400" />
                    <span>{t('employees.performance')}: {employee.performance}/5.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t('common.close')}
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              {t('employees.editEmployee')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
