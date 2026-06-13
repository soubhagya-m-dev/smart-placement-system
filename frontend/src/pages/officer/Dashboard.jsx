import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Briefcase, CheckCircle, IndianRupee, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function OfficerDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ totalStudents: 0, verifiedStudents: 0, activeJobs: 0, placed: 0, avgPackageLpa: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/stats/dashboard`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setStats(data.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-blue-600">Placement Hub</h1><p className="text-gray-500 text-sm">Officer Dashboard</p></div>
          <button onClick={logout} className="flex items-center gap-2 text-gray-600 hover:text-red-600"><LogOut className="w-5 h-5" /> Logout</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Welcome, {user?.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link to="/officer/students" className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:opacity-95 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-blue-100">Total Students</p><p className="text-3xl font-bold mt-1">{stats.totalStudents}</p></div><Users className="w-10 h-10 text-blue-200" /></div></Link>
          <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white"><div className="flex items-center justify-between"><div><p className="text-green-100">Verified</p><p className="text-3xl font-bold mt-1">{stats.verifiedStudents}</p></div><CheckCircle className="w-10 h-10 text-green-200" /></div></div>
          <div className="card bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"><div className="flex items-center justify-between"><div><p className="text-yellow-100">Avg Package</p><p className="text-3xl font-bold mt-1">{stats.avgPackageLpa ? `${stats.avgPackageLpa} LPA` : '—'}</p></div><IndianRupee className="w-10 h-10 text-yellow-200" /></div></div>
          <Link to="/officer/jobs" className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-lg hover:opacity-95 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-purple-100">Active Jobs</p><p className="text-3xl font-bold mt-1">{stats.activeJobs}</p></div><Briefcase className="w-10 h-10 text-purple-200" /></div></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/officer/jobs" className="card hover:shadow-lg transition"><h3 className="font-semibold mb-2">Manage Jobs</h3><p className="text-gray-500 text-sm">Post and manage job listings</p></Link>
          <Link to="/officer/verify" className="card hover:shadow-lg transition"><h3 className="font-semibold mb-2">Verify Students</h3><p className="text-gray-500 text-sm">Approve pending registrations</p></Link>
          <Link to="/officer/stats" className="card hover:shadow-lg transition"><h3 className="font-semibold mb-2">View Statistics</h3><p className="text-gray-500 text-sm">Analyze placement data</p></Link>
        </div>
      </main>
    </div>
  );
}
