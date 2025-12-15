import { useState, useEffect } from 'react'
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Award, FileText, Loader } from 'lucide-react'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { UploadProvider } from './contexts/UploadContext'
import { Dashboard, Employee, EmployeeCard, EmployeeModal, Header, Login, TaskListing, PlaceHolder, Reports, Search, Sidebar, StatsCard, TimeTracking, TimeClockEntry, Notifications, Settings, AddNewEmployee, DeleteEmployeeManager, ControlPanel, TaskReview, PersonalGoals, FlubberIconTest, Recruitment, AdvancedHelpCenter, ProductionHelpCenter } from './components/index.jsx';
import * as employeeService from './services/employeeService';
import * as recruitmentService from './services/recruitmentService';
import { logVisit } from './services/visitService';

const Applications = [
  {
    id: 1,
    candidateName: 'Alex Thompson',
    position: 'Frontend Developer',
    department: 'Engineering',
    status: 'Interview Scheduled',
    appliedDate: '2024-08-15',
    email: 'alex.thompson@email.com',
    experience: '3 years',
    stage: 'technical'
  },
  {
    id: 2,
    candidateName: 'Maria Garcia',
    position: 'Content Writer',
    department: 'Marketing',
    status: 'Under Review',
    appliedDate: '2024-08-18',
    email: 'maria.garcia@email.com',
    experience: '2 years',
    stage: 'screening'
  },
  {
    id: 3,
    candidateName: 'David Kim',
    position: 'Sales Representative',
    department: 'Sales',
    status: 'Offer Extended',
    appliedDate: '2024-08-10',
    email: 'david.kim@email.com',
    experience: '4 years',
    stage: 'offer'
  }
];

const HRManagementApp = () => {
  const { isAuthenticated, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch employees from Supabase
  const fetchEmployees = async () => {
    setLoading(true);
    const result = await employeeService.getAllEmployees();
    if (result.success) {
      setEmployees(result.data);
      
      // If no employees exist, seed with initial data
      if (result.data.length === 0) {
        console.log('No employees found, seeding initial data...');
        // Create employees one by one to avoid bulk upsert issues
        const createdEmployees = [];
        for (const emp of employees) {
          const seedResult = await employeeService.createEmployee(emp);
          if (seedResult.success) {
            createdEmployees.push(seedResult.data);
          } else {
            console.error('Error seeding employee:', emp.name, seedResult.error);
          }
        }
        if (createdEmployees.length > 0) {
          setEmployees(createdEmployees);
        }
      }
    } else {
      setError(result.error);
      console.error('Error fetching employees:', result.error);
      // Fallback to hardcoded data if Supabase fails
      setEmployees(employees);
    }
    setLoading(false);
  };

  // Fetch employees on mount and when auth changes
  useEffect(() => {
    fetchEmployees();
  }, [isAuthenticated, user]);
  
  // Refetch employees (expose this to child components)
  const refetchEmployees = async () => {
    const result = await employeeService.getAllEmployees();
    if (result.success) {
      setEmployees(result.data);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  // Fetch applications from Supabase on mount
  useEffect(() => {
    const fetchApplications = async () => {
      // Check if recruitment tables exist (migration 005 has been run)
      const result = await recruitmentService.getAllApplications();
      if (result.success) {
        // Transform data to match expected format
        const transformedData = result.data.map(app => ({
          id: app.id,
          candidateName: app.candidate_name || app.applicant?.name || (app.applicant?.first_name ? `${app.applicant.first_name} ${app.applicant.last_name}` : 'Unknown'),
          position: app.job_posting?.title || 'N/A',
          positionKey: app.job_posting?.titleKey,
          department: app.job_posting?.department || 'N/A',
          status: app.status,
          appliedDate: app.applied_date || app.application_date,
          email: app.email || app.applicant?.email,
          experience: app.experience_years ? `${app.experience_years} years` : (app.applicant?.years_experience ? `${app.applicant.years_experience} years` : 'N/A'),
          stage: app.stage
        }));
        setApplications(transformedData);
      } else {
        // Tables don't exist yet or other error - use fallback data
        console.warn('Recruitment tables not found. Please run migration 005_recruitment_tables.sql');
        console.warn('Using fallback mock data for applications.');
        setApplications(Applications);
      }
    };

    fetchApplications();
  }, [isAuthenticated, user]);

  const handlePhotoUpdate = async (employeeId, photoData, useStorage = false) => {
    try {
      let photoUrl = photoData;
      
      // Optionally upload to Supabase Storage
      if (useStorage && photoData) {
        const uploadResult = await employeeService.uploadEmployeePhoto(photoData, employeeId);
        if (uploadResult.success) {
          photoUrl = uploadResult.url;
        } else {
          console.warn('Photo upload failed, using base64:', uploadResult.error);
          // Continue with base64 if storage fails
        }
      }
      
      // Update employee photo in Supabase database
      const result = await employeeService.updateEmployee(employeeId, { photo: photoUrl });
      
      if (result.success) {
        // Update local state
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.id === employeeId ? { ...emp, photo: photoUrl } : emp
          )
        );
        return { success: true, url: photoUrl };
      } else {
        console.error('Error updating photo in database:', result.error);
        alert('Failed to update photo. Please try again.');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error in handlePhotoUpdate:', error);
      alert('An error occurred while updating the photo.');
      return { success: false, error: error.message };
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsEditMode(true);
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setIsEditMode(false);
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmMessage = `⚠️ WARNING: This will PERMANENTLY delete ${employee.name} and ALL their data including:\n\n` +
                          `• Time entries\n` +
                          `• Leave requests\n` +
                          `• Overtime logs\n` +
                          `• Performance records\n\n` +
                          `This action CANNOT be undone!\n\n` +
                          `Are you absolutely sure you want to proceed?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        // Permanently delete the employee and all related data
        const result = await employeeService.deleteEmployee(employee.id);

        if (result.success) {
          // Remove from local state immediately
          setEmployees(employees.filter(emp => emp.id !== employee.id));
          alert(`${employee.name} has been permanently deleted.`);
          
          // Refresh the employee list from server
          await refetchEmployees();
        } else {
          console.error('Error deleting employee:', result.error);
          alert(`Failed to delete employee: ${result.error}`);
        }
      } catch (error) {
        console.error('Error in handleDeleteEmployee:', error);
        alert('An unexpected error occurred while deleting the employee.');
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedEmployee(null);
    setIsEditMode(false);
  };

  return (
    <LanguageProvider>
      <ThemeProvider>
        <UploadProvider>
          <NotificationProvider>
            <AppContent 
              employees={employees}
              applications={applications}
              selectedEmployee={selectedEmployee}
              isEditMode={isEditMode}
              onViewEmployee={handleViewEmployee}
              onEditEmployee={handleEditEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onCloseModal={handleCloseModal}
              onPhotoUpdate={handlePhotoUpdate}
              refetchEmployees={refetchEmployees}
              loading={loading}
              error={error}
              isMobileMenuOpen={isMobileMenuOpen}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          </NotificationProvider>
        </UploadProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

const AppContent = ({ employees, applications, selectedEmployee, isEditMode, onViewEmployee, onEditEmployee, onDeleteEmployee, onCloseModal, onPhotoUpdate, refetchEmployees, loading, error, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { bg, text } = useTheme();
  const { isAuthenticated } = useAuth();
  const { currentLanguage } = useLanguage();

  // Record a visit once per app render
  useEffect(() => {
    logVisit();
  }, []);

  // Show loading state while fetching data
  if (loading && isAuthenticated) {
    return (
      <div className={`min-h-screen ${bg.primary} flex items-center justify-center`}>
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className={`text-lg ${text.primary}`}>Loading HR Management System...</p>
        </div>
      </div>
    );
  }

  // Show error state if data fetch failed
  if (error && isAuthenticated) {
    return (
      <div className={`min-h-screen ${bg.primary} flex items-center justify-center`}>
        <div className="text-center">
          <p className={`text-lg ${text.primary} mb-4`}>Error loading data: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Route - Login */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/time-clock" replace /> : <Login />
        } />
          
          {/* Private Route - Login first) */}
          <Route path="/flubber-test" element={<FlubberIconTest />} />
          
          {/* Protected Routes */}
          <Route path="/*" element={
            isAuthenticated ? (
              <div className={`min-h-screen ${bg.primary}`}>
                <Header 
                  key={currentLanguage} 
                  isMobileMenuOpen={isMobileMenuOpen}
                  setIsMobileMenuOpen={setIsMobileMenuOpen}
                />
              
              <div className="flex">
                <Sidebar 
                  key={currentLanguage} 
                  isMobileMenuOpen={isMobileMenuOpen}
                  setIsMobileMenuOpen={setIsMobileMenuOpen}
                />
                
                {/* Main Content - Full width utilization */}
                <div className="flex-1 p-3 sm:p-4 lg:p-8 w-full mx-auto">
                  <Routes>
                    <Route path="/" element={<Navigate to="/time-clock" replace />} />
                    <Route 
                      path="/time-clock" 
                      element={<TimeClockEntry currentLanguage={currentLanguage} />} 
                    />
                    <Route 
                      path="/dashboard" 
                      element={<Dashboard employees={employees.filter(emp => emp.status !== 'Inactive' && emp.status !== 'inactive')} applications={applications} />} 
                    />
                    <Route 
                      path="/employees" 
                      element={<Employee employees={employees} onViewEmployee={onViewEmployee} onEditEmployee={onEditEmployee} onDeleteEmployee={onDeleteEmployee} onPhotoUpdate={onPhotoUpdate} refetchEmployees={refetchEmployees} />} 
                    />
                    <Route 
                      path="/employees/add" 
                      element={<AddNewEmployee refetchEmployees={refetchEmployees} />} 
                    />
                    <Route 
                      path="/time-tracking" 
                      element={<TimeTracking employees={employees} />} 
                    />
                    <Route 
                      path="/task-review" 
                      element={<TaskReview employees={employees} />} 
                    />
                    <Route 
                      path="/personal-goals" 
                      element={<PersonalGoals employees={employees} />} 
                    />
                    <Route 
                      path="/control-panel" 
                      element={<ControlPanel />} 
                    />
                    <Route 
                      path="/help-center" 
                      element={<AdvancedHelpCenter />} 
                    />
                    <Route 
                      path="/production-help" 
                      element={<ProductionHelpCenter />} 
                    />
                    <Route 
                      path="/task-listing" 
                      element={<TaskListing employees={employees} />} 
                    />
                    <Route 
                      path="/reports" 
                      element={<Reports />} 
                    />
                    <Route 
                      path="/recruitment" 
                      element={<Recruitment />} 
                    />
                    <Route 
                      path="/notifications" 
                      element={<Notifications />} 
                    />
                    <Route 
                      path="/settings" 
                      element={<Settings />} 
                    />
                    <Route 
                      path="/delete-manager" 
                      element={<DeleteEmployeeManager />} 
                    />
                  </Routes>
                </div>
              </div>

              <EmployeeModal 
                employee={selectedEmployee}
                initialEditMode={isEditMode}
                onClose={onCloseModal}
                onUpdate={async (updatedEmployee) => {
                  // Refetch employees to get latest data
                  await refetchEmployees();
                }}
              />
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
    </Router>
  );
};

export default HRManagementApp;
