import { useState, useEffect } from 'react'
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Award, FileText } from 'lucide-react'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AddEmployeeModal, Dashboard, Employee, EmployeeCard, EmployeeModal, Header, Login, PerformanceAppraisal, PlaceHolder, Reports, Search, Sidebar, StatsCard, TimeTracking, TimeClockEntry } from './components/index.jsx';

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
    performance: 3.8,
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
    performance: 4.2,
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
    performance: 4.6,
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
    performance: 4.4,
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
    performance: 4.9,
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
    performance: 4.7,
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
  const [employees, setEmployees] = useState(() => {
    // Load saved employees and photos from localStorage
    const savedEmployees = localStorage.getItem('employees');
    const savedPhotos = localStorage.getItem('employeePhotos');
    
    let employeesList = Employees;
    
    // Load saved employees if available
    if (savedEmployees) {
      try {
        employeesList = JSON.parse(savedEmployees);
      } catch (error) {
        console.error('Error loading saved employees:', error);
      }
    }
    
    // Apply saved photos
    if (savedPhotos) {
      try {
        const photosMap = JSON.parse(savedPhotos);
        employeesList = employeesList.map(emp => ({
          ...emp,
          photo: photosMap[emp.id] || emp.photo
        }));
      } catch (error) {
        console.error('Error loading saved photos:', error);
      }
    }
    
    return employeesList;
  });
  const [applications, setApplications] = useState(Applications);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);

  const handlePhotoUpdate = (employeeId, photoData) => {
    setEmployees(prevEmployees => {
      const updatedEmployees = prevEmployees.map(emp => 
        emp.id === employeeId ? { ...emp, photo: photoData } : emp
      );
      
      // Save to localStorage
      try {
        const savedPhotos = localStorage.getItem('employeePhotos');
        const photosMap = savedPhotos ? JSON.parse(savedPhotos) : {};
        photosMap[employeeId] = photoData;
        localStorage.setItem('employeePhotos', JSON.stringify(photosMap));
      } catch (error) {
        console.error('Error saving photo:', error);
      }
      
      return updatedEmployees;
    });
  };

  const handleAddEmployee = (newEmployee) => {
    setEmployees(prevEmployees => {
      const updatedEmployees = [...prevEmployees, newEmployee];
      
      // Save to localStorage
      try {
        localStorage.setItem('employees', JSON.stringify(updatedEmployees));
      } catch (error) {
        console.error('Error saving employees:', error);
      }
      
      return updatedEmployees;
    });
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
          />
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};

const AppContent = ({ employees, applications, selectedEmployee, setSelectedEmployee, onPhotoUpdate, isAddEmployeeModalOpen, setIsAddEmployeeModalOpen, onAddEmployee }) => {
  const { bg } = useTheme();
  const { isAuthenticated } = useAuth();

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
                
                <div className="flex-1 p-8">
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
