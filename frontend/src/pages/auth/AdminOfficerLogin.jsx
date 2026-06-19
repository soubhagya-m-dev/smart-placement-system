import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaUserShield, FaEnvelope, FaLock } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminOfficerLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuth(); // Get setUser from AuthContext
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/admin-login`, {
        email: form.email,
        password: form.password
      });
      
      if (res.data.success) {
        const { token, user: userData } = res.data.data;
        
        // Store token
        localStorage.setItem('token', token);
        
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Update AuthContext so app knows user is logged in
        setUser(userData);
        
        toast.success(`Welcome, ${userData.name}!`);
        
        // Redirect based on role
        if (userData.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (userData.role === 'officer') {
          // Land on the dashboard by default (overview + at-a-glance stats).
          // The officer can navigate to /officer/jobs, /officer/verify, or
          // /officer/stats from the sidebar/header.
          navigate('/officer');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <FaUserShield className="text-3xl text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Staff Portal</h1>
          <p className="text-blue-300">Admin & Placement Officer Login</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Email Address</label>
              <div className="relative">
                <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@placement.com"
                  className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Password</label>
              <div className="relative">
                <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter password"
                  className="w-full bg-white dark:bg-gray-800/10 border border-white/20 rounded-xl py-3 pl-12 pr-4 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          {/* Back to student login */}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-blue-300 hover:text-white text-sm flex items-center justify-center gap-2">
              ← Back to Student Login
            </Link>
          </div>
        </form>

        {/* Info */}
        
      </div>
    </div>
  );
}