import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, DollarSign } from 'lucide-react';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ 
    jobTitle: '', 
    companyName: '', 
    location: '', 
    skills: '',
    jobType: '', 
    salaryMin: '' 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.jobTitle) params.append('jobTitle', filters.jobTitle);
      if (filters.companyName) params.append('companyName', filters.companyName);
      if (filters.location) params.append('location', filters.location);
      if (filters.skills) params.append('skills', filters.skills);
      if (filters.jobType) params.append('jobType', filters.jobType);
      if (filters.salaryMin) params.append('salaryMin', filters.salaryMin);
      
      const res = await fetch(`/api/jobs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setJobs(data.data.jobs);
    } catch (error) { console.error('Failed to fetch'); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const clearFilters = () => {
    setFilters({ jobTitle: '', companyName: '', location: '', skills: '', jobType: '', salaryMin: '' });
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Advanced Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input type="text" className="input" placeholder="Job Title" value={filters.jobTitle} onChange={e => setFilters({...filters, jobTitle: e.target.value})} />
              <input type="text" className="input" placeholder="Company Name" value={filters.companyName} onChange={e => setFilters({...filters, companyName: e.target.value})} />
              <input type="text" className="input" placeholder="Location" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} />
              <input type="text" className="input" placeholder="Skills (comma separated)" value={filters.skills} onChange={e => setFilters({...filters, skills: e.target.value})} />
            </div>
            
            {/* Salary Range and Job Type */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="relative">
                <input type="number" className="input pl-8" placeholder="Min Salary (LPA)" value={filters.salaryMin} onChange={e => setFilters({...filters, salaryMin: e.target.value})} />
              </div>
              <select className="input" value={filters.jobType} onChange={e => setFilters({...filters, jobType: e.target.value})}>
                <option value="">Job Type</option>
                <option value="full-time">Full Time</option>
                <option value="internship">Internship</option>
                <option value="part-time">Part Time</option>
              </select>
              <div className="flex gap-2 col-span-2">
                <button type="submit" className="btn-primary flex-1">Search</button>
                <button type="button" onClick={clearFilters} className="btn-secondary px-4">Clear</button>
              </div>
            </div>
          </form>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Available Jobs</h1>
        {loading ? (
          <div className="space-y-4">{[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-white rounded-xl animate-pulse"></div>)}</div>
        ) : jobs.length === 0 ? (
          <div className="card text-center py-16"><Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No jobs found</h3><p className="text-gray-500">Try adjusting your search filters</p></div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => (
              <Link key={job._id} to={`/jobs/${job._id}`} className="card hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-gray-600 mt-1">{job.companyName}</p>
                    <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location || 'Not specified'}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{job.salary?.min?.toFixed(2) || '0.00'} - {job.salary?.max?.toFixed(2) || '0.00'} LPA</span>
                    </div>
                    <div className="flex gap-2 mt-3">{job.requiredSkills?.slice(0, 4).map((skill, i) => <span key={i} className="badge badge-blue">{skill}</span>)}</div>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-green">{job.jobType}</span>
                    <p className="text-sm text-gray-500 mt-2">{job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-GB') : 'Application deadline'}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}