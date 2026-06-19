import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import Login from './pages/auth/Login';
import AdminOfficerLogin from './pages/auth/AdminOfficerLogin';
import StudentDashboard from './pages/student/Dashboard';
import Jobs from './pages/student/Jobs';
import JobDetails from './pages/student/JobDetails';
import Applications from './pages/student/Applications';
import Notifications from './pages/student/Notifications';
import Profile from './pages/student/Profile';
import OfficerDashboard from './pages/officer/Dashboard';
import ManageJobs from './pages/officer/ManageJobs';
import VerifyStudents from './pages/officer/VerifyStudents';
import Stats from './pages/officer/Stats';
import AllStudents from './pages/officer/AllStudents';
import AdminDashboard from './pages/admin/Dashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

// Restricts students who haven't completed profile + been verified by TPO
function StudentAccessRoute({ children }) {
  const { user, loading } = useAuth();
  const [accessStatus, setAccessStatus] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'student') { setAccessStatus({ canAccess: true }); return; }
    axios.get(`${API_URL}/api/students/status`)
      .then(res => {
        const data = res.data.data;
        // Determine canAccess based on actual response fields
        const canAccess = data.isProfileComplete && data.isVerified && data.status !== 'rejected';
        setAccessStatus({ 
          canAccess, 
          code: !data.isProfileComplete ? 'PROFILE_INCOMPLETE' : 
                !data.isVerified ? 'PENDING_VERIFICATION' : 
                data.status === 'rejected' ? 'ACCOUNT_REJECTED' : 'OK',
          message: !data.isProfileComplete ? 'Please complete your profile to access all features.' :
                   !data.isVerified ? 'Your profile is under review by the placement officer.' :
                   data.status === 'rejected' ? 'Your account has been rejected. Contact placement officer.' :
                   'Access granted',
          rejectionReason: data.rejectionReason || null
        });
      })
      .catch(() => setAccessStatus({ canAccess: false, code: 'ERROR', message: 'Failed to check access' }));
  }, [user]);

  if (loading || accessStatus === null) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'student') return children; // officers/admins always allowed

  if (!accessStatus.canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-4">
            {accessStatus.code === 'PROFILE_INCOMPLETE' ? '📋' : accessStatus.code === 'PENDING_VERIFICATION' ? '⏳' : '❌'}
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {accessStatus.code === 'PROFILE_INCOMPLETE' ? 'Complete Your Profile' : 
             accessStatus.code === 'PENDING_VERIFICATION' ? 'Profile Under Review' : 
             'Access Denied'}
          </h2>
          <p className="text-gray-600 mb-2">{accessStatus.message}</p>
          {accessStatus.code === 'PENDING_VERIFICATION' && (
            <p className="text-sm text-gray-500">Placement officer will verify your profile soon.</p>
          )}
          {accessStatus.code === 'PROFILE_INCOMPLETE' && (
            <p className="text-sm text-gray-500">Fill in all required fields and save your profile.</p>
          )}
          {accessStatus.code === 'ACCOUNT_REJECTED' && accessStatus.rejectionReason && (
            <p className="text-sm text-red-500 mt-2">Reason: {accessStatus.rejectionReason}</p>
          )}
          <Navigate to="/profile" replace />
        </div>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/admin-login" element={user ? <Navigate to="/" /> : <AdminOfficerLogin />} />
      <Route path="/" element={<ProtectedRoute>{
        user?.role === 'admin' ? <AdminDashboard /> : 
        user?.role === 'officer' ? <OfficerDashboard /> : 
        <StudentDashboard />
      }</ProtectedRoute>} />
      <Route path="/jobs" element={
        <ProtectedRoute>
          <StudentAccessRoute><Jobs /></StudentAccessRoute>
        </ProtectedRoute>
      } />
      <Route path="/jobs/:id" element={
        <ProtectedRoute>
          <StudentAccessRoute><JobDetails /></StudentAccessRoute>
        </ProtectedRoute>
      } />
      <Route path="/applications" element={
        <ProtectedRoute>
          <StudentAccessRoute><Applications /></StudentAccessRoute>
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute roles={['student']}><Profile /></ProtectedRoute>} />
      <Route path="/officer/jobs" element={<ProtectedRoute roles={['officer']}><ManageJobs /></ProtectedRoute>} />
      <Route path="/officer/verify" element={<ProtectedRoute roles={['officer']}><VerifyStudents /></ProtectedRoute>} />
      <Route path="/officer/stats" element={<ProtectedRoute roles={['officer']}><Stats /></ProtectedRoute>} />
      <Route path="/officer/students" element={<ProtectedRoute roles={['officer']}><AllStudents /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}