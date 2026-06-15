import { useState, useEffect } from 'react';
import { Users, Briefcase, FileText, CheckCircle, Clock, TrendingUp, LogOut, Plus, Trash2, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ totalStudents: 0, verifiedStudents: 0, totalOfficers: 0, activeJobs: 0, totalApplications: 0, placed: 0 });
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [statsRes, officersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/officers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const statsData = await statsRes.json();
      const officersData = await officersRes.json();
      if (statsData.success) setStats(statsData.data);
      if (officersData.success) setOfficers(officersData.data.officers);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setFormData({ name: '', email: '', password: '', phone: '' });
        fetchData();
        alert('Officer created successfully!');
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to create officer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOfficer = async (id) => {
    if (!confirm('Are you sure you want to remove this officer?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/officers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        alert('Officer removed');
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to delete officer');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-purple-600">Placement Hub</h1>
              <p className="text-gray-500 text-sm">Admin Dashboard</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-gray-600 hover:text-red-600">
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Welcome, {user?.name}</h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Students</p>
                <p className="text-3xl font-bold mt-1">{stats.totalStudents}</p>
              </div>
              <Users className="w-10 h-10 text-blue-200" />
            </div>
          </div>
          <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Verified</p>
                <p className="text-3xl font-bold mt-1">{stats.verifiedStudents}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-200" />
            </div>
          </div>
          <div className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Officers</p>
                <p className="text-3xl font-bold mt-1">{stats.totalOfficers}</p>
              </div>
              <Shield className="w-10 h-10 text-purple-200" />
            </div>
          </div>
          <div className="card bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">Active Jobs</p>
                <p className="text-3xl font-bold mt-1">{stats.activeJobs}</p>
              </div>
              <Briefcase className="w-10 h-10 text-yellow-200" />
            </div>
          </div>
        </div>

        {/* Officers Management */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Manage Officers</h3>
            <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Officer
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>)}</div>
          ) : officers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No officers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Phone</th>
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {officers.map(officer => (
                    <tr key={officer._id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{officer.name}</td>
                      <td className="py-3 px-4 text-gray-600">{officer.email}</td>
                      <td className="py-3 px-4 text-gray-600">{officer.phone || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{new Date(officer.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => handleDeleteOfficer(officer._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Officer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Officer</h3>
            <form onSubmit={handleCreateOfficer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" required className="input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" required className="input w-full" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" required className="input w-full" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone (optional)</label>
                <input type="tel" className="input w-full" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}