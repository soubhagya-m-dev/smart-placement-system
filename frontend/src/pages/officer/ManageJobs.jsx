import { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManageJobs() {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', companyName: '', location: '', jobType: 'full-time', description: '', salaryMin: '', salaryMax: '', requiredSkills: '', applicationDeadline: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/officer/my-jobs', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setJobs(data.data.jobs);
    } catch (error) { console.error('Failed'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, salary: { min: parseInt(form.salaryMin), max: parseInt(form.salaryMax) }, requiredSkills: form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) };
      const res = await fetch('/api/jobs', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { toast.success('Job posted!'); setShowModal(false); fetchJobs(); }
      else toast.error(data.message);
    } catch { toast.error('Failed'); }
  };

  const deleteJob = async (id) => {
    if (!confirm('Delete this job?')) return;
    await fetch(`/api/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    toast.success('Deleted');
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Manage Jobs</h1>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> Post Job</button>
        </div>
        {loading ? <div className="space-y-4">{[1,2].map(i => <div key={i} className="card h-20 animate-pulse"></div>)}</div> : jobs.length === 0 ? (
          <div className="card text-center py-12"><Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No jobs posted</h3></div>
        ) : (
          <div className="space-y-4">{jobs.map(job => (
            <div key={job._id} className="card flex items-center justify-between">
              <div><h3 className="font-semibold text-lg">{job.title}</h3><p className="text-gray-500">{job.companyName} • {job.location}</p><span className="badge badge-blue mt-1">{job.jobType}</span></div>
              <button onClick={() => deleteJob(job._id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-5 h-5" /></button>
            </div>
          ))}</div>
        )}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold mb-4">Post New Job</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" className="input" placeholder="Job Title" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                <input type="text" className="input" placeholder="Company Name" required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} />
                <input type="text" className="input" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                <select className="input" value={form.jobType} onChange={e => setForm({...form, jobType: e.target.value})}><option value="full-time">Full Time</option><option value="internship">Internship</option><option value="part-time">Part Time</option></select>
                <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                <div className="grid grid-cols-2 gap-4"><input type="number" className="input" placeholder="Min Salary (LPA)" value={form.salaryMin} onChange={e => setForm({...form, salaryMin: e.target.value})} /><input type="number" className="input" placeholder="Max Salary (LPA)" value={form.salaryMax} onChange={e => setForm({...form, salaryMax: e.target.value})} /></div>
                <input type="text" className="input" placeholder="Skills (comma-separated)" value={form.requiredSkills} onChange={e => setForm({...form, requiredSkills: e.target.value})} />
                <input type="date" className="input" value={form.applicationDeadline} onChange={e => setForm({...form, applicationDeadline: e.target.value})} />
                <div className="flex gap-4"><button type="submit" className="btn-primary flex-1">Post</button><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
