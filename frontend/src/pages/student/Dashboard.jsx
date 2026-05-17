import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, CheckCircle, Clock, TrendingUp, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const [stats, setStats] = useState({ totalApplications: 0, placed: 0, pending: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, jobsRes] = await Promise.all([
          fetch('/api/stats/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch('/api/jobs?limit=5', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        ]);
        const statsData = await statsRes.json();
        const jobsData = await jobsRes.json();
        if (statsData.success) setStats(statsData.data);
        if (jobsData.success) setRecentJobs(jobsData.data.jobs);
      } catch (error) { console.error('Failed to fetch data'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-blue-600">Placement Hub</h1><p className="text-gray-500 text-sm">Welcome, {user?.name}</p></div>
          <div className="flex items-center gap-4">
            <Link to="/applications" className="relative p-2 hover:bg-gray-100 rounded-full"><Bell className="w-6 h-6 text-gray-600" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>}</Link>
            <button onClick={logout} className="flex items-center gap-2 text-gray-600 hover:text-red-600"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white"><div className="flex items-center justify-between"><div><p className="text-blue-100">Total Applications</p><p className="text-3xl font-bold mt-1">{stats.totalApplications}</p></div><FileText className="w-10 h-10 text-blue-200" /></div></div>
          <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white"><div className="flex items-center justify-between"><div><p className="text-green-100">Placed</p><p className="text-3xl font-bold mt-1">{stats.placed}</p></div><CheckCircle className="w-10 h-10 text-green-200" /></div></div>
          <div className="card bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"><div className="flex items-center justify-between"><div><p className="text-yellow-100">Pending</p><p className="text-3xl font-bold mt-1">{stats.pending}</p></div><Clock className="w-10 h-10 text-yellow-200" /></div></div>
          <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white"><div className="flex items-center justify-between"><div><p className="text-purple-100">Success Rate</p><p className="text-3xl font-bold mt-1">{stats.totalApplications > 0 ? Math.round((stats.placed / stats.totalApplications) * 100) : 0}%</p></div><TrendingUp className="w-10 h-10 text-purple-200" /></div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to="/jobs" className="card hover:shadow-lg transition flex items-center gap-4"><div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-blue-600" /></div><div><h3 className="font-semibold">Browse Jobs</h3><p className="text-gray-500 text-sm">Find your dream job</p></div></Link>
          <Link to="/applications" className="card hover:shadow-lg transition flex items-center gap-4"><div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><FileText className="w-6 h-6 text-green-600" /></div><div><h3 className="font-semibold">My Applications</h3><p className="text-gray-500 text-sm">Track your progress</p></div></Link>
          <Link to="/profile" className="card hover:shadow-lg transition flex items-center gap-4"><div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-6 h-6 text-purple-600" /></div><div><h3 className="font-semibold">My Profile</h3><p className="text-gray-500 text-sm">Update your details</p></div></Link>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Recent Job Openings</h2><Link to="/jobs" className="text-blue-600 hover:underline text-sm">View All</Link></div>
          {loading ? <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>)}</div> : recentJobs.length === 0 ? <p className="text-gray-500 text-center py-8">No jobs available</p> : (
            <div className="space-y-4">
              {recentJobs.map(job => (
                <Link key={job._id} to={`/jobs/${job._id}`} className="block p-4 border rounded-lg hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between">
                    <div><h3 className="font-semibold text-gray-900">{job.title}</h3><p className="text-gray-500 text-sm">{job.companyName} • {job.location}</p></div>
                    <div className="text-right"><p className="font-semibold text-green-600">₹{(job.salary?.max / 100000).toFixed(1)} LPA</p><span className="badge badge-blue">{job.jobType}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
