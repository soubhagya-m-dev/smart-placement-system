import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign, Filter, Search, X, Bookmark, Trash2, ChevronDown, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]); // Don't init from localStorage - always fetch from server
  const [filters, setFilters] = useState({ 
    jobTitle: '', 
    companyName: '', 
    location: '', 
    skills: '', 
    jobType: '', 
    salaryMin: ''
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showEligible, setShowEligible] = useState(false);

  useEffect(() => { fetchJobs(); fetchSavedJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.jobTitle) params.append('jobTitle', filters.jobTitle);
      if (filters.companyName) params.append('companyName', filters.companyName);
      if (filters.location) params.append('location', filters.location);
      if (filters.skills) params.append('skills', filters.skills);
      if (filters.jobType) params.append('jobType', filters.jobType);
      if (filters.salaryMin) params.append('salaryMin', filters.salaryMin);
      
      const res = await fetch(`${API_URL}/api/jobs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setJobs(data.data.jobs);
    } catch (error) { console.error('Failed to fetch'); }
    finally { setLoading(false); }
  };

  const fetchSavedJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/saved`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) { 
        setSavedJobs(data.data.jobs);
      }
    } catch (error) { console.error('Failed to fetch saved jobs'); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const clearFilters = () => {
    const cleared = { jobTitle: '', companyName: '', location: '', skills: '', jobType: '', salaryMin: '' };
    setFilters(cleared);
    fetch(`${API_URL}/api/jobs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()).then(data => {
      if (data.success) setJobs(data.data.jobs);
    });
  };

  const toggleSaveJob = async (jobId) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Toggle save - token exists:', !!token, '| jobId:', jobId);
      const res = await fetch(`${API_URL}/api/jobs/saved/${jobId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      console.log('Toggle save - status:', res.status);
      const data = await res.json();
      console.log('Toggle save - response:', JSON.stringify(data));
      if (data.success) {
        if (data.data.saved) {
          const jobToSave = jobs.find(j => j._id === jobId);
          if (jobToSave) setSavedJobs(prev => [...prev, jobToSave]);
        } else {
          setSavedJobs(prev => prev.filter(j => j._id !== jobId));
        }
        toast.success(data.data.saved ? 'Job saved!' : 'Removed from saved jobs');
      } else {
        toast.error(data.message || 'Failed to update saved jobs');
      }
    } catch (error) { 
      console.error('Toggle save error:', error);
      toast.error('Failed to update'); 
    }
  };

  const isJobSaved = (jobId) => savedJobs.some(j => j._id === jobId);
  const isJobExpired = (job) => job.applicationDeadline && new Date(job.applicationDeadline) < new Date();

  const isEligible = (job) => {
    const sp = user?.studentProfile;
    if (!sp) return false;
    if (job.eligibility?.minCGPA && sp.currentCGPA < job.eligibility.minCGPA) return false;
    if (job.eligibility?.class12Percentage && sp.twelfthPercentage < job.eligibility.class12Percentage) return false;
    if (job.eligibility?.class10Percentage && sp.tenthPercentage < job.eligibility.class10Percentage) return false;
    return true;
  };

  const eligibleCount = jobs.filter(j => !isJobExpired(j) && isEligible(j)).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          
          {/* Header with Filter and Saved Jobs Toggles - Side by Side */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Dashboard</span>
              </Link>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-100 transition"
              >
                <Filter className="w-5 h-5" />
                <span className="font-medium">Filters</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowEligible(!showEligible)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-medium">Eligible Jobs ({eligibleCount})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showEligible ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => setShowSaved(!showSaved)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-100 transition"
              >
                <Bookmark className="w-5 h-5" />
                <span className="font-medium">Saved Jobs ({savedJobs.length})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showSaved ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Expanded Sections */}
          {(showFilters || showSaved || showEligible) && (
            <div className="mt-4 space-y-4">
              
              {/* Filters Section - Full Width */}
              {showFilters && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Job Filters
                  </h3>
                  <form onSubmit={handleSearch} className="space-y-3">
<div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                      <input type="text" className="input" placeholder="Job Title" value={filters.jobTitle} onChange={e => setFilters({...filters, jobTitle: e.target.value})} />
                      <input type="text" className="input" placeholder="Company Name" value={filters.companyName} onChange={e => setFilters({...filters, companyName: e.target.value})} />
                      <input type="text" className="input" placeholder="Location" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} />
                      <input type="text" className="input" placeholder="Skills" value={filters.skills} onChange={e => setFilters({...filters, skills: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                      <input type="number" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="Min Salary (LPA)" value={filters.salaryMin} onChange={e => setFilters({...filters, salaryMin: e.target.value})} />
                      <select className="input" value={filters.jobType} onChange={e => setFilters({...filters, jobType: e.target.value})}>
                        <option value="">Job Type</option>
                        <option value="full-time">Full Time</option>
                        <option value="internship">Internship</option>
                        <option value="part-time">Part Time</option>
                      </select>
                      <button type="submit" className="btn-primary flex items-center justify-center gap-2 flex-1">
                        <Search className="w-4 h-4" /> Search
                      </button>
                      <button type="button" onClick={clearFilters} className="btn-secondary flex items-center justify-center gap-2 px-4">
                        <X className="w-4 h-4" /> Clear
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Right: Saved Jobs Section */}
              {showSaved && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Bookmark className="w-4 h-4" /> Saved Jobs ({savedJobs.length})
                  </h3>
                  {savedJobs.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No saved jobs yet. Click the bookmark icon on any job to save it.</p>
                  ) : (
                    <div className="space-y-2 max-h-20 overflow-y-auto">
                      {savedJobs.map(job => (
                        <div key={job._id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <Link to={`/jobs/${job._id}`} className="flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setShowSaved(false)}>
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{job.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.companyName}</p>
                          </Link>
                          <button
                            onClick={() => toggleSaveJob(job._id)}
                            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition ml-2"
                            title="Remove from saved"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Eligible Jobs Section */}
              {showEligible && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Eligible Jobs ({eligibleCount})
                  </h3>
                  {eligibleCount === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No jobs match your eligibility criteria yet. Check back later!</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {jobs.filter(j => !isJobExpired(j) && isEligible(j)).map(job => (
                        <div key={job._id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                          <Link to={`/jobs/${job._id}`} className="flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400" onClick={() => setShowEligible(false)}>
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{job.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{job.companyName}</p>
                          </Link>
                          <span className="ml-2 text-green-600 text-xs font-medium">✅ Eligible</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Available Jobs</h1>
        {loading ? (
          <div className="space-y-4">{[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-white dark:bg-gray-800 rounded-xl animate-pulse"></div>)}</div>
        ) : jobs.length === 0 ? (
          <div className="card text-center py-16"><Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No jobs found</h3><p className="text-gray-500 dark:text-gray-400">Try adjusting your search filters</p></div>
        ) : (
          <div className="grid gap-4">
            {(() => {
              const userSkills = (user?.studentProfile?.skills || []).map(s => s.toLowerCase());
              const nonExpired = jobs
                .filter(j => !isJobExpired(j))
                .sort((a, b) => {
                  const aSaved = isJobSaved(a._id);
                  const bSaved = isJobSaved(b._id);
                  const aMatch = a.requiredSkills?.filter(s => userSkills.includes(s.toLowerCase())).length || 0;
                  const bMatch = b.requiredSkills?.filter(s => userSkills.includes(s.toLowerCase())).length || 0;
                  if (aSaved && !bSaved) return -1;
                  if (!aSaved && bSaved) return 1;
                  if (bMatch !== aMatch) return bMatch - aMatch;
                  return 0;
                });
              const expired = jobs
                .filter(j => isJobExpired(j))
                .sort((a, b) => {
                  const aSaved = isJobSaved(a._id);
                  const bSaved = isJobSaved(b._id);
                  if (aSaved && !bSaved) return -1;
                  if (!aSaved && bSaved) return 1;
                  return 0;
                });
              return [...nonExpired, ...expired];
            })()
              .map(job => (
              <div key={job._id} className={`card transition ${isJobSaved(job._id) ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : isJobExpired(job) ? 'ring-2 ring-red-400 bg-red-50 dark:bg-red-900/30' : 'hover:shadow-lg'}`}>
                <div className="flex items-start justify-between">
                  <Link to={`/jobs/${job._id}`} className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{job.title}</h3>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSaveJob(job._id); }}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <Bookmark className={`w-5 h-5 ${isJobSaved(job._id) ? 'text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">{job.companyName}</p>
                    <div className="flex items-center gap-4 mt-3 text-gray-500 dark:text-gray-400 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location || 'Not specified'}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{job.salary?.min?.toFixed(2) || '0.00'} - {job.salary?.max?.toFixed(2) || '0.00'} LPA</span>
                    </div>
                    <div className="flex gap-2 mt-3">{job.requiredSkills?.slice(0, 4).map((skill, i) => <span key={i} className="badge badge-blue">{skill}</span>)}</div>
                  </Link>
                  <div className="text-right ml-4">
                    {new Date(job.applicationDeadline) < new Date() ? (
                      <span className="badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">🔴 Expired</span>
                    ) : (
                      <span className="badge badge-green">{job.jobType}</span>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center justify-end gap-1"><span>📅</span> Apply by {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-GB') : 'No deadline'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}