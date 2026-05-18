import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import StudentDashboard from './pages/student/Dashboard';
import Jobs from './pages/student/Jobs';
import JobDetails from './pages/student/JobDetails';
import Applications from './pages/student/Applications';
import Profile from './pages/student/Profile';
import OfficerDashboard from './pages/officer/Dashboard';
import ManageJobs from './pages/officer/ManageJobs';
import VerifyStudents from './pages/officer/VerifyStudents';
import Stats from './pages/officer/Stats';
import AdminDashboard from './pages/admin/Dashboard';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/" element={<ProtectedRoute>{
        user?.role === 'admin' ? <AdminDashboard /> : 
        user?.role === 'officer' ? <OfficerDashboard /> : 
        <StudentDashboard />
      }</ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/officer/jobs" element={<ProtectedRoute roles={['officer']}><ManageJobs /></ProtectedRoute>} />
      <Route path="/officer/verify" element={<ProtectedRoute roles={['officer']}><VerifyStudents /></ProtectedRoute>} />
      <Route path="/officer/stats" element={<ProtectedRoute roles={['officer']}><Stats /></ProtectedRoute>} />
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
