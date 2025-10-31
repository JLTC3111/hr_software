import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Search, Filter, User, Shield, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as employeeService from '../services/employeeService';

const DeleteEmployeeManager = () => {
  const { isDarkMode, bg, text, border } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Define roles that have permission to permanently delete
  const ALLOWED_ROLES = ['admin', 'manager', 'general_manager'];

  useEffect(() => {
    // Check user permissions
    const userRole = user?.user_metadata?.role || user?.role || 'employee';
    setHasPermission(ALLOWED_ROLES.includes(userRole.toLowerCase()));
    
    // Fetch all employees including inactive ones
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    setLoading(true);
    const result = await employeeService.getAllEmployees();
    if (result.success) {
      setEmployees(result.data);
    }
    setLoading(false);
  };

  const handlePermanentDelete = async (employee) => {
    const confirmMessage = `⚠️ PERMANENT DELETE WARNING ⚠️\n\nYou are about to PERMANENTLY delete:\n\nEmployee: ${employee.name}\nID: ${employee.id}\nEmail: ${employee.email}\n\nThis action:\n• Cannot be undone\n• Will remove ALL employee data\n• Will delete time tracking records\n• Will delete performance reviews\n• Will delete all associated files\n\nType "DELETE" to confirm this permanent action.`;
    
    const userInput = window.prompt(confirmMessage);
    
    if (userInput === 'DELETE') {
      setDeleting(employee.id);
      try {
        const result = await employeeService.deleteEmployee(employee.id);
        
        if (result.success) {
          setEmployees(employees.filter(emp => emp.id !== employee.id));
          alert(`✅ ${employee.name} has been permanently deleted from the system.`);
        } else {
          alert(`❌ Failed to delete employee: ${result.error}`);
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('❌ An unexpected error occurred during deletion.');
      } finally {
        setDeleting(null);
      }
    } else if (userInput !== null) {
      alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.id.toString().toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         emp.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Show permission denied if user doesn't have access
  if (!hasPermission) {
    return (
      <div className={`min-h-screen ${bg.primary} p-6`}>
        <div className={`max-w-4xl mx-auto ${bg.secondary} rounded-lg shadow-lg p-8 border ${border.primary}`}>
          <div className="text-center">
            <Shield className={`w-16 h-16 mx-auto mb-4 ${text.secondary}`} />
            <h2 className={`text-2xl font-bold ${text.primary} mb-2`}>Access Denied</h2>
            <p className={`${text.secondary} mb-4`}>
              You do not have permission to access the Employee Deletion Manager.
            </p>
            <p className={`text-sm ${text.secondary}`}>
              Required roles: Admin, HR Manager, or General Manager
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg.primary} p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Warning */}
        <div className={`${bg.secondary} rounded-lg shadow-lg p-6 border-2 border-red-500`}>
          <div className="flex items-start space-x-4">
            <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h1 className={`text-2xl font-bold ${text.primary} mb-2`}>
                Employee Deletion Manager
              </h1>
              <p className={`${text.secondary} mb-2`}>
                <strong className="text-red-600">⚠️ DANGER ZONE:</strong> This tool permanently deletes employee data from the database.
              </p>
              <ul className={`text-sm ${text.secondary} space-y-1 ml-4`}>
                <li>• Deleted data <strong>cannot be recovered</strong></li>
                <li>• All associated records will be removed</li>
                <li>• Use "Inactive" status for soft deletion instead</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary}`} />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              />
            </div>
            <div className="relative">
              <Filter className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${text.secondary}`} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${border.primary} ${bg.primary} ${text.primary} focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer`}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="onLeave">On Leave</option>
              </select>
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary}`}>
          <div className="p-4 border-b ${border.primary}">
            <h2 className={`text-lg font-semibold ${text.primary}`}>
              Employees ({filteredEmployees.length})
            </h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <Loader className={`w-8 h-8 animate-spin ${text.secondary} mx-auto mb-2`} />
              <p className={text.secondary}>Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <User className={`w-12 h-12 ${text.secondary} mx-auto mb-2 opacity-50`} />
              <p className={text.secondary}>No employees found</p>
            </div>
          ) : (
            <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredEmployees.map((employee) => (
                <div 
                  key={employee.id}
                  className={`p-4 transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} ${
                    deleting === employee.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        {employee.photo ? (
                          <img 
                            src={employee.photo} 
                            alt={employee.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${text.primary}`}>{employee.name}</h3>
                        <div className="flex items-center space-x-3 text-sm">
                          <span className={text.secondary}>{employee.email}</span>
                          <span className={text.secondary}>•</span>
                          <span className={text.secondary}>ID: {employee.id}</span>
                          <span className={text.secondary}>•</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            employee.status === 'Active' ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800') :
                            employee.status === 'Inactive' ? (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800') :
                            (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800')
                          }`}>
                            {employee.status}
                          </span>
                        </div>
                        <p className={`text-sm ${text.secondary} mt-1`}>
                          {employee.position} • {employee.department}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePermanentDelete(employee)}
                      disabled={deleting === employee.id}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        deleting === employee.id
                          ? isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
                      }`}
                    >
                      {deleting === employee.id ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Permanent Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className={`${bg.secondary} rounded-lg shadow-sm border ${border.primary} p-4`}>
          <h3 className={`font-semibold ${text.primary} mb-2 flex items-center`}>
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            Recommended: Soft Delete
          </h3>
          <p className={`text-sm ${text.secondary} mb-3`}>
            For most cases, marking an employee as "Inactive" is recommended. This:
          </p>
          <ul className={`text-sm ${text.secondary} space-y-1 ml-6`}>
            <li>• Preserves historical data and records</li>
            <li>• Allows for future reference and audits</li>
            <li>• Can be reversed if needed</li>
            <li>• Maintains data integrity</li>
          </ul>
          
          <h3 className={`font-semibold ${text.primary} mt-4 mb-2 flex items-center`}>
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
            Use Permanent Delete Only When:
          </h3>
          <ul className={`text-sm ${text.secondary} space-y-1 ml-6`}>
            <li>• Employee data was entered incorrectly</li>
            <li>• Duplicate records exist</li>
            <li>• Legal requirement to remove data (GDPR, etc.)</li>
            <li>• Test data needs to be cleaned up</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DeleteEmployeeManager;
