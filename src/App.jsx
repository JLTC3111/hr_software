import { useState, useEffect } from 'react'
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Award, FileText, Loader } from 'lucide-react'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AddEmployeeModal, Dashboard, Employee, EmployeeCard, EmployeeModal, Header, Login, PerformanceAppraisal, PlaceHolder, Reports, Search, Sidebar, StatsCard, TimeTracking, TimeClockEntry } from './components/index.jsx';
import * as employeeService from './services/employeeService';
import * as recruitmentService from './services/recruitmentService';

const Employees = [
  {
    id: 1,
    name: 'Trịnh Thị Tình',
    position: 'general_manager',
    department: 'legal_compliance',
    email: 'info@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2015-01-15',
    status: 'Active',
    performance: 4.2,
    photo: 'employeeProfilePhotos/tinh.png'
  },
  {
    id: 2,
    name: ' Đỗ Bảo Long',
    position: 'senior_developer',
    department: 'internal_ affairs',
    email: 'dev@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 375889900',
    startDate: '2017-08-20',
    status: 'onLeave',
    performance: 4.6,
    photo: 'employeeProfilePhotos/longdo.jpg'
  },
  {
    id: 3,
    name: 'Nguyễn Thị Ly',
    position: 'hr_specialist',
    department: 'human_resources',
    email: 'support@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2023-03-10',
    status: 'Active',
    performance: 4.1,
    photo: 'employeeProfilePhotos/lyly.png'
  },
  {
    id: 4,
    name: 'Nguyễn Thị Hiến',
    position: 'accountant',
    department: 'finance',
    email: 'billing@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2021-11-05',
    status: 'Active',
    performance: 4.3,
    photo: 'employeeProfilePhotos/hien.png'
  },
  {
    id: 5,
    name: 'Nguyễn Quỳnh Ly  ',
    position: 'contract_manager',
    department: 'office_unit',
    email: 'contract@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2023-06-01',
    status: 'Active',
    performance: 3.4,
    photo: 'employeeProfilePhotos/quynhly.png'
  },
  {
    id: 6,
    name: 'Nguyễn Hồng Hạnh',
    position: 'managing_director',
    department: 'board_of_directors',
    email: 'hanhnguyen@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2017-08-20',
    status: 'Active',
    performance: 4.4,
    photo: 'employeeProfilePhotos/nguyenhonghanh.jpg'
  },
  {
    id: 7,
    name: 'Đinh Tùng Dương',
    position: 'support_staff',
    department: 'office_unit',
    email: 'support@icue.vn',
    dob: '2000-01-01',
    address: 'Hà Nội',
    phone: '+84 909 999 999',
    startDate: '2017-08-20',
    status: 'Inactive',
    performance: 3.0,
    photo: 'employeeProfilePhotos/duong.png'
  },
];

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
  const [employees, setEmployees] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch employees from Supabase on mount
  useEffect(() => {
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
          for (const emp of Employees) {
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
        setEmployees(Employees);
      }
      setLoading(false);
    };

    fetchEmployees();
  }, []);

  // Fetch applications from Supabase on mount
  useEffect(() => {
    const fetchApplications = async () => {
      // Check if recruitment tables exist (migration 005 has been run)
      const result = await recruitmentService.getAllApplications();
      if (result.success) {
        // Transform data to match expected format
        const transformedData = result.data.map(app => ({
          id: app.id,
          candidateName: app.candidate_name,
          position: app.job_posting?.title || 'N/A',
          department: app.job_posting?.department || 'N/A',
          status: app.status,
          appliedDate: app.applied_date,
          email: app.email,
          experience: `${app.experience_years} years`,
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
  }, []);

  const handlePhotoUpdate = async (employeeId, photoData) => {
    // Update employee photo in Supabase
    const result = await employeeService.updateEmployee(employeeId, { photo: photoData });
    
    if (result.success) {
      // Update local state
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === employeeId ? { ...emp, photo: photoData } : emp
        )
      );
    } else {
      console.error('Error updating photo:', result.error);
      alert('Failed to update photo. Please try again.');
    }
  };

  const handleAddEmployee = async (newEmployee) => {
    // Create employee in Supabase
    const result = await employeeService.createEmployee(newEmployee);
    
    if (result.success) {
      // Add to local state
      setEmployees(prevEmployees => [...prevEmployees, result.data]);
      setIsAddEmployeeModalOpen(false);
    } else {
      console.error('Error adding employee:', result.error);
      alert('Failed to add employee. Please try again.');
    }
  };

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppContent 
            employees={employees}
            applications={applications}
            selectedEmployee={selectedEmployee}
            setSelectedEmployee={setSelectedEmployee}
            onPhotoUpdate={handlePhotoUpdate}
            isAddEmployeeModalOpen={isAddEmployeeModalOpen}
            setIsAddEmployeeModalOpen={setIsAddEmployeeModalOpen}
            onAddEmployee={handleAddEmployee}
            loading={loading}
            error={error}
          />
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};

const AppContent = ({ employees, applications, selectedEmployee, setSelectedEmployee, onPhotoUpdate, isAddEmployeeModalOpen, setIsAddEmployeeModalOpen, onAddEmployee, loading, error }) => {
  const { bg, text } = useTheme();
  const { isAuthenticated } = useAuth();

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
        
        {/* Protected Routes */}
        <Route path="/*" element={
          isAuthenticated ? (
            <div className={`min-h-screen ${bg.primary}`}>
              <Header />
              
              <div className="flex">
                <Sidebar />
                
                {/* Main Content - Add padding-top on mobile for hamburger button */}
                <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 w-full lg:min-w-[768px] mx-auto">
                  <Routes>
                    <Route path="/" element={<Navigate to="/time-clock" replace />} />
                    <Route 
                      path="/time-clock" 
                      element={<TimeClockEntry />} 
                    />
                    <Route 
                      path="/dashboard" 
                      element={<Dashboard employees={employees} applications={applications} />} 
                    />
                    <Route 
                      path="/employees" 
                      element={<Employee employees={employees} onViewEmployee={setSelectedEmployee} onPhotoUpdate={onPhotoUpdate} onAddEmployeeClick={() => setIsAddEmployeeModalOpen(true)} />} 
                    />
                    <Route 
                      path="/time-tracking" 
                      element={<TimeTracking employees={employees} />} 
                    />
                    <Route 
                      path="/performance" 
                      element={<PerformanceAppraisal employees={employees} />} 
                    />
                    <Route 
                      path="/reports" 
                      element={<Reports employees={employees} applications={applications} />} 
                    />
                  </Routes>
                </div>
              </div>

              <EmployeeModal 
                employee={selectedEmployee} 
                onClose={() => setSelectedEmployee(null)} 
              />
              
              <AddEmployeeModal 
                isOpen={isAddEmployeeModalOpen}
                onClose={() => setIsAddEmployeeModalOpen(false)}
                onAddEmployee={onAddEmployee}
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
