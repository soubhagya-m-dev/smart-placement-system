import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, DollarSign, Briefcase, Calendar, CheckCircle, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);

  useEffect(() => { fetchJob(); }, [id]);

  const fetchJob = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      console.log('JobDetails API response:', JSON.stringify(data, null, 2));
      if (data.success) {
        setJob(data.data.job);
        setStudentProfile(data.data.studentProfile);
      }
    } catch (error) { console.error('Failed to fetch', error); }
    finally { setLoading(false); }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch(`${API_URL}/api/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Applied successfully!');
        navigate('/applications');
      } else {
        toast.error(data.message || 'Failed to apply');
      }
    } catch (error) { toast.error('Failed to apply'); }
    finally { setApplying(false); }
  };

  const handleToggleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/jobs/saved/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setIsSaved(data.data.saved);
        
        // Fetch fresh saved jobs list and dispatch event
        const savedRes = await fetch(`${API_URL}/api/jobs/saved`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
        });
        const savedData = await savedRes.json();
        if (savedData.success) {
          window.dispatchEvent(new CustomEvent('savedJobsUpdated', { detail: savedData.data.jobs }));
        }
        
        toast.success(data.data.saved ? 'Job saved!' : 'Job removed from saved');
      } else {
        toast.error('Failed to update saved status');
      }
    } catch (error) { toast.error('Failed to update saved status'); }
    finally { setSaving(false); }
  };

  // Check if job is saved on mount
  useEffect(() => {
    if (id) {
      fetch(`${API_URL}/api/jobs/saved`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            const savedIds = data.data.jobs.map(j => j._id);
            setIsSaved(savedIds.includes(id));
          }
        })
        .catch(() => {});
    }
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const isExpired = job?.applicationDeadline && new Date(job.applicationDeadline) < new Date();
  const isJobNotFound = !job;

  if (isJobNotFound) return <div className="text-center py-16"><h2 className="text-xl font-semibold">Job not found</h2><Link to="/jobs" className="btn-primary mt-4">Back to Jobs</Link></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/jobs" className="flex items-center gap-2 text-gray-600 hover:text-blue-600"><ArrowLeft className="w-5 h-5" /> Back to Jobs</Link>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="card mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
                {isExpired && <span className="badge bg-red-100 text-red-700 border border-red-200">🔴 Expired</span>}
              </div>
              <p className="text-xl text-gray-600 mt-1">{job.companyName}</p>
              <div className="flex items-center gap-6 mt-4 text-gray-500">
                <span className="flex items-center gap-2"><MapPin className="w-5 h-5" />{job.location || 'Not specified'}</span>
                <span className="flex items-center gap-2"><DollarSign className="w-5 h-5" />{job.salary?.min?.toFixed(2) || '0.00'} - {job.salary?.max?.toFixed(2) || '0.00'} LPA</span>
                <span className="flex items-center gap-2"><Briefcase className="w-5 h-5" />{job.jobType}</span>
                <span className="flex items-center gap-2"><Calendar className="w-5 h-5" />{job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-GB') : 'Application deadline'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleToggleSave} disabled={saving} className={`p-3 border rounded-lg transition ${isSaved ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
                <Bookmark className={`w-5 h-5 ${isSaved ? 'text-blue-600 fill-blue-600' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
          <button onClick={handleApply} disabled={applying || job.hasApplied || isExpired} className={`btn-primary w-full py-4 mt-6 text-lg ${isExpired ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isExpired ? '🔴 Applications Closed' : applying ? 'Applying...' : job.hasApplied ? <><CheckCircle className="w-5 h-5 inline mr-2" /> Already Applied</> : 'Apply Now'}
          </button>
        </div>
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Job Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Required Skills</h2>
            <div className="flex flex-wrap gap-2">{job.requiredSkills?.map((skill, i) => <span key={i} className="badge badge-blue text-sm px-3 py-2">{skill}</span>) || <p className="text-gray-500">Not specified</p>}</div>
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Eligibility</h2>
            {job.eligibility?.minCGPA || job.eligibility?.class12Percentage || job.eligibility?.class10Percentage ? (
              <div className="space-y-2">
                {job.eligibility?.minCGPA && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${studentProfile?.currentCGPA >= job.eligibility.minCGPA ? '✅' : '❌'}`}>
                        {studentProfile?.currentCGPA >= job.eligibility.minCGPA ? '✅' : '❌'}
                      </span>
                      <span className="text-gray-600">CGPA</span>
                    </div>
                    <span className={`font-medium ${studentProfile?.currentCGPA >= job.eligibility.minCGPA ? 'text-green-600' : 'text-red-600'}`}>
                      {studentProfile?.currentCGPA ?? '—'} <span className="text-gray-400 text-sm">/ {job.eligibility.minCGPA}</span>
                    </span>
                  </div>
                )}
                {job.eligibility?.class12Percentage && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${studentProfile?.twelfthPercentage >= job.eligibility.class12Percentage ? '✅' : '❌'}`}>
                        {studentProfile?.twelfthPercentage >= job.eligibility.class12Percentage ? '✅' : '❌'}
                      </span>
                      <span className="text-gray-600">Class 12 %</span>
                    </div>
                    <span className={`font-medium ${studentProfile?.twelfthPercentage >= job.eligibility.class12Percentage ? 'text-green-600' : 'text-red-600'}`}>
                      {studentProfile?.twelfthPercentage ?? '—'} <span className="text-gray-400 text-sm">/ {job.eligibility.class12Percentage}%</span>
                    </span>
                  </div>
                )}
                {job.eligibility?.class10Percentage && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${studentProfile?.tenthPercentage >= job.eligibility.class10Percentage ? '✅' : '❌'}`}>
                        {studentProfile?.tenthPercentage >= job.eligibility.class10Percentage ? '✅' : '❌'}
                      </span>
                      <span className="text-gray-600">Class 10 %</span>
                    </div>
                    <span className={`font-medium ${studentProfile?.tenthPercentage >= job.eligibility.class10Percentage ? 'text-green-600' : 'text-red-600'}`}>
                      {studentProfile?.tenthPercentage ?? '—'} <span className="text-gray-400 text-sm">/ {job.eligibility.class10Percentage}%</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No eligibility criteria defined.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}