import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Briefcase, MapPin, DollarSign } from 'lucide-react';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ jobType: '', location: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.jobType) params.append('jobType', filters.jobType);
      if (filters.location) params.append('location', filters.location);
      
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" className="input pl-10" placeholder="Search jobs, companies, skills..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-48" value={filters.jobType} onChange={e => setFilters({...filters, jobType: e.target.value})}>
              <option value="">Job Type</option>
              <option value="full-time">Full Time</option>
              <option value="internship">Internship</option>
              <option value="part-time">Part Time</option>
            </select>
            <input type="text" className="input w-48" placeholder="Location" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} />
            <button type="submit" className="btn-primary px-6">Search</button>
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
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{(job.salary?.min / 100000).toFixed(1)} - {(job.salary?.max / 100000).toFixed(1)} LPA</span>
                    </div>
                    <div className="flex gap-2 mt-3">{job.requiredSkills?.slice(0, 4).map((skill, i) => <span key={i} className="badge badge-blue">{skill}</span>)}</div>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-green">{job.jobType}</span>
                    <p className="text-sm text-gray-500 mt-2">{new Date(job.applicationDeadline).toLocaleDateString()} deadline</p>
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
