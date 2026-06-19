import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, CheckCircle, Clock, TrendingUp, LogOut, Bell, AlertCircle, Award, KeyRound, Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import ThemeToggle from '../../components/ThemeToggle';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function StudentDashboard() {
  const { user, logout, changePassword } = useAuth();
  const { unreadCount, newNotifFlag } = useSocket();
  const [stats, setStats] = useState({ totalApplications: 0, shortlisted: 0, placed: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState(null); // null = checking
  const [bellPing, setBellPing] = useState(false);

  // ============================================================
  // Forced password change (officer-created accounts)
  // When the officer creates a student, they get a temp password
  // and the user.mustChangePassword flag is set server-side. The
  // student MUST set their own password before using the dashboard.
  // We render a non-dismissible modal that intercepts the whole page
  // until the password is changed. The dashboard itself stays mounted
  // in the background but is non-interactive.
  // ============================================================
  const mustChangePw = !!user?.mustChangePassword;
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState({ current: false, next: false, confirm: false });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState('');

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    if (pwForm.next.length < 6) return setPwErr('New password must be at least 6 characters.');
    if (pwForm.next !== pwForm.confirm) return setPwErr('Passwords do not match.');
    if (pwForm.next === pwForm.current) return setPwErr('New password must differ from the current one.');
    setPwBusy(true);
    try {
      // We pass the temp password as "current" — for officer-created
      // accounts this is exactly what the officer shared. The backend
      // also requires the current password to match, so it acts as a
      // sanity check that the student has the right temp password.
      await changePassword(pwForm.current, pwForm.next);
      // No need to navigate — the user object is now refreshed by
      // changePassword(), so mustChangePw flips to false and the
      // modal disappears.
    } catch (err) {
      setPwErr(err?.response?.data?.message || err.message || 'Could not change password.');
    } finally {
      setPwBusy(false);
    }
  };

  useEffect(() => {
    fetchData();
    checkAccessStatus();
  }, []);

  // Play a one-shot "ping" animation on the bell every time a new socket
  // notification arrives. The animation lasts ~1.2s (defined in the className),
  // then we clear the trigger so it doesn't replay on re-renders.
  useEffect(() => {
    if (newNotifFlag === 0) return;
    setBellPing(true);
    const t = setTimeout(() => setBellPing(false), 1300);
    return () => clearTimeout(t);
  }, [newNotifFlag]);

  const checkAccessStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/students/status`);
      setAccessStatus(res.data.data);
    } catch (error) { /* Silently fail - will default to restricted */ }
  };

  const fetchData = async () => {
    try {
      const [statsRes, jobsRes] = await Promise.all([
        fetch(`${API_URL}/api/stats/dashboard`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch(`${API_URL}/api/jobs?limit=5`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ]);
      const statsData = await statsRes.json();
      const jobsData = await jobsRes.json();
      if (statsData.success) setStats({ totalApplications: 0, shortlisted: 0, placed: 0, ...statsData.data });
      if (jobsData.success) setRecentJobs(jobsData.data.jobs.filter(j => !j.applicationDeadline || new Date(j.applicationDeadline) >= new Date()));
    } catch (error) { console.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const isRestricted = accessStatus && (!accessStatus.isProfileComplete || !accessStatus.isVerified || accessStatus.status === 'rejected');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Placement Hub</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Welcome, {user?.name}</p></div>
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <div className="relative">
                <Bell className={`w-6 h-6 text-gray-600 dark:text-gray-300 ${bellPing ? 'animate-bellPing' : ''}`} />
                {/* Always render the badge so the number is visible; the count itself is
                    the source of truth (synced on socket connect + on every new notif). */}
                {unreadCount > 0 && (
                  <span className={`absolute -top-0.5 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ${bellPing ? 'animate-badgePop' : ''}`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {bellPing && (
                  <span className="absolute inset-0 -m-1 rounded-full bg-blue-400/40 animate-pingRing pointer-events-none" />
                )}
              </div>
            </Link>
            <ThemeToggle />
            <button onClick={logout} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"><LogOut className="w-5 h-5" /> Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Access restriction banner */}
        {(accessStatus && (!accessStatus.isProfileComplete || !accessStatus.isVerified || accessStatus.status === 'rejected')) && (
          <div className="card mb-6 border-2 border-yellow-300 bg-yellow-50">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800">
                  {!accessStatus.isProfileComplete ? '⚠️ Complete Your Profile to Access Full Features' :
                   !accessStatus.isVerified ? '⏳ Your Profile is Pending Verification' :
                   accessStatus.status === 'rejected' ? '❌ Your Account Has Been Rejected' : ''}
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                  {!accessStatus.isProfileComplete ? 'Please fill in all required fields in your profile. Once complete, your profile will be reviewed by the placement officer.' :
                   !accessStatus.isVerified ? 'The placement officer is reviewing your profile. You will be notified once verified.' :
                   accessStatus.rejectionReason ? `Reason: ${accessStatus.rejectionReason}` : 'Contact the placement officer for more information.'}
                </p>
                <Link to="/profile" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium">
                  {!accessStatus.isProfileComplete ? '📋 Complete Profile Now' : '👁️ View Profile'}
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link to="/applications" className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:from-blue-600 hover:to-blue-700 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-blue-100">Total Applications</p><p className="text-3xl font-bold mt-1">{stats.totalApplications}</p></div><FileText className="w-10 h-10 text-blue-200" /></div></Link>
          <Link to="/applications?status=shortlisted" className="card bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:shadow-lg hover:from-yellow-600 hover:to-yellow-700 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-yellow-100">Shortlisted</p><p className="text-3xl font-bold mt-1">{stats.shortlisted}</p></div><CheckCircle className="w-10 h-10 text-yellow-200" /></div></Link>
          <Link to="/applications?status=accepted" className="card bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:from-green-600 hover:to-green-700 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-green-100">Placed</p><p className="text-3xl font-bold mt-1">{stats.placed}</p></div><Award className="w-10 h-10 text-green-200" /></div></Link>
          <Link to="/applications?status=accepted" className="card bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-lg hover:from-purple-600 hover:to-purple-700 transition cursor-pointer"><div className="flex items-center justify-between"><div><p className="text-purple-100">Success Rate</p><p className="text-3xl font-bold mt-1">{stats.totalApplications > 0 ? Math.round((stats.placed / stats.totalApplications) * 100) : 0}%</p></div><TrendingUp className="w-10 h-10 text-purple-200" /></div></Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to={isRestricted ? '/profile' : '/jobs'} className={`card hover:shadow-lg transition flex items-center gap-4 ${isRestricted ? 'opacity-60' : ''}`}>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <h3 className="font-semibold">Browse Jobs</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{isRestricted ? 'Complete profile to access' : 'Find your dream job'}</p>
            </div>
          </Link>
          <Link to={isRestricted ? '/profile' : '/applications'} className={`card hover:shadow-lg transition flex items-center gap-4 ${isRestricted ? 'opacity-60' : ''}`}>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center"><FileText className="w-6 h-6 text-green-600" /></div>
            <div>
              <h3 className="font-semibold">My Applications</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{isRestricted ? 'Complete profile to access' : 'Track your progress'}</p>
            </div>
          </Link>
          <Link to="/profile" className="card hover:shadow-lg transition flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-6 h-6 text-purple-600" /></div>
            <div><h3 className="font-semibold">My Profile</h3><p className="text-gray-500 dark:text-gray-400 text-sm">Update your details</p></div>
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Recent Job Openings</h2><Link to={isRestricted ? '/profile' : '/jobs'} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">View All</Link></div>
          {loading ? <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"></div>)}</div> : recentJobs.length === 0 ? <p className="text-gray-500 dark:text-gray-400 text-center py-8">No jobs available</p> : (
            <div className="space-y-4">
              {recentJobs.map(job => (
                <Link key={job._id} to={isRestricted ? '/profile' : `/jobs/${job._id}`} className={`block p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition ${isRestricted ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{job.title}</h3><p className="text-gray-500 dark:text-gray-400 text-sm">{job.companyName} • {job.location}</p></div>
                    <div className="text-right"><p className="font-semibold text-green-600">₹{job.salary?.min?.toFixed(2) || '0.00'} - ₹{job.salary?.max?.toFixed(2) || '0.00'} LPA</p><span className="badge badge-blue">{job.jobType}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ============================================================ */}
      {/* FORCED PASSWORD CHANGE — rendered above everything when       */}
      {/* user.mustChangePassword is true. Non-dismissible: no backdrop  */}
      {/* click handler, no Escape key, no X button. The student can    */}
      {/* either set a new password or log out (top-right of card).     */}
      {/* ============================================================ */}
      {mustChangePw && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 animate-[fadeIn_150ms_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="force-pw-title"
          data-testid="force-pw-modal"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_200ms_ease-out]">
            <form onSubmit={submitChangePassword}>
              <div className="px-6 py-5 border-b flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 id="force-pw-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Set your password
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Welcome, {user?.name?.split(' ')[0] || 'student'} — the placement officer created
                    your account. Please choose a password to continue.
                  </p>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Current (temp) password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Temporary password
                  </label>
                  <div className="relative">
                    <input
                      type={pwShow.current ? 'text' : 'password'}
                      required
                      autoFocus
                      value={pwForm.current}
                      onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
                      placeholder="Paste the password the officer shared"
                      className="w-full pl-3 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPwShow(s => ({ ...s, current: !s.current }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                      aria-label={pwShow.current ? 'Hide password' : 'Show password'}
                    >
                      {pwShow.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={pwShow.next ? 'text' : 'password'}
                      required
                      value={pwForm.next}
                      onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))}
                      placeholder="At least 6 characters"
                      className="w-full pl-3 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPwShow(s => ({ ...s, next: !s.next }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                      aria-label={pwShow.next ? 'Hide password' : 'Show password'}
                    >
                      {pwShow.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm new password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={pwShow.confirm ? 'text' : 'password'}
                      required
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                      className="w-full pl-3 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPwShow(s => ({ ...s, confirm: !s.confirm }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                      aria-label={pwShow.confirm ? 'Hide password' : 'Show password'}
                    >
                      {pwShow.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {pwErr && (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{pwErr}</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>After this step you'll be taken to your profile to fill in roll number, branch, etc.</span>
                </div>
              </div>

              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t flex items-center justify-between">
                <button
                  type="button"
                  onClick={logout}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 transition flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
                <button
                  type="submit"
                  disabled={pwBusy || !pwForm.current || !pwForm.next || !pwForm.confirm}
                  className="px-5 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {pwBusy ? 'Saving…' : 'Save & continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}