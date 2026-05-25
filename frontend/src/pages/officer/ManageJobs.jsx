import { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase, Edit, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ManageJobs() {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [form, setForm] = useState({ 
    title: '', companyName: '', location: '', jobType: 'full-time', description: '', 
    salaryMin: '', salaryMax: '', requiredSkills: '', applicationDeadline: '',
    eligibility: { minCGPA: '', class12Percentage: '', class10Percentage: '' }
  });
  const [loading, setLoading] = useState(true);

  // Applicants modal state
  const [showApplicantsModal, setShowApplicantsModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/officer/my-jobs`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setJobs(data.data.jobs);
    } catch (error) { console.error('Failed'); }
    finally { setLoading(false); }
  };

  const openCreateModal = () => {
    setEditingJob(null);
    setForm({ 
      title: '', companyName: '', location: '', jobType: 'full-time', description: '', 
      salaryMin: '', salaryMax: '', requiredSkills: '', applicationDeadline: '',
      eligibility: { minCGPA: '', class12Percentage: '', class10Percentage: '' }
    });
    setShowModal(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setForm({
      title: job.title || '',
      companyName: job.companyName || '',
      location: job.location || '',
      jobType: job.jobType || 'full-time',
      description: job.description || '',
      salaryMin: job.salary?.min?.toString() || '',
      salaryMax: job.salary?.max?.toString() || '',
      requiredSkills: job.requiredSkills?.join(', ') || '',
      applicationDeadline: job.applicationDeadline ? job.applicationDeadline.split('T')[0] : '',
      eligibility: {
        minCGPA: job.eligibility?.minCGPA?.toString() || '',
        class12Percentage: job.eligibility?.class12Percentage?.toString() || '',
        class10Percentage: job.eligibility?.class10Percentage?.toString() || ''
      }
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        ...form, 
        salary: { min: parseFloat(form.salaryMin) || 0, max: parseFloat(form.salaryMax) || 0 }, 
        requiredSkills: form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        eligibility: {
          minCGPA: parseFloat(form.eligibility.minCGPA) || null,
          class12Percentage: parseFloat(form.eligibility.class12Percentage) || null,
          class10Percentage: parseFloat(form.eligibility.class10Percentage) || null
        }
      };

      let res;
      if (editingJob) {
        res = await fetch(`${API_URL}/api/jobs/${editingJob._id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/api/jobs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      const data = await res.json();
      if (data.success) { 
        toast.success(editingJob ? 'Job updated!' : 'Job posted!'); 
        setShowModal(false); 
        setEditingJob(null);
        fetchJobs(); 
      }
      else toast.error(data.message);
    } catch { toast.error('Failed'); }
  };

  const deleteJob = async (id) => {
    if (!confirm('Delete this job?')) return;
    await fetch(`${API_URL}/api/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    toast.success('Deleted');
    fetchJobs();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingJob(null);
  };

  // View applicants for a job
  const viewApplicants = async (job) => {
    setSelectedJob(job);
    setShowApplicantsModal(true);
    setApplicantsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/officer/job-applicants/${job._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setApplicants(data.data.applicants);
        setSelectedJob(prev => ({ ...prev, eligibility: data.data.job.eligibility }));
      } else {
        toast.error(data.message);
        setApplicants([]);
      }
    } catch {
      toast.error('Failed to fetch applicants');
      setApplicants([]);
    } finally {
      setApplicantsLoading(false);
    }
  };

  const isStudentEligible = (app) => {
    if (!selectedJob?.eligibility) return true;
    const el = selectedJob.eligibility;
    const sp = app.student.studentProfile || {};

    const cgpa = sp.currentCGPA ?? app.student.cgpa;
    const cls12 = sp.twelfthPercentage ?? app.student.class12Percentage;
    const cls10 = sp.tenthPercentage ?? app.student.class10Percentage;

    if (el.minCGPA !== undefined && (cgpa === undefined || cgpa === null || cgpa < el.minCGPA)) return false;
    if (el.class12Percentage !== undefined && (cls12 === undefined || cls12 === null || cls12 < el.class12Percentage)) return false;
    if (el.class10Percentage !== undefined && (cls10 === undefined || cls10 === null || cls10 < el.class10Percentage)) return false;

    return true;
  };

  // Update application status
  const updateApplicationStatus = async (applicationId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/officer/application/${applicationId}`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Application ${newStatus}`);
        // Update local state
        setApplicants(prev => prev.map(app => 
          app.applicationId === applicationId ? { ...app, status: newStatus } : app
        ));
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Export applicants as CSV
  const exportCSV = () => {
    if (applicants.length === 0) {
      toast.error('No applicants to export');
      return;
    }

    // User-requested order: University Roll, Name, Email, Phone, Status, College ID, Reg No, Admission Type, Stream, Section, Gender, Dob, CGPA, Class 10 %, Class 12 %, Skills, + remaining fields
    const headers = ['University Roll', 'Name', 'Email', 'Phone', 'Status', 'Eligibility', 'College ID', 'Reg. No', 'Admission Type', 'Stream', 'Section', 'Gender', 'DOB', 'CGPA', 'Class 10 %', 'Class 12 %', 'Skills', 'Class 10 Board', 'Class 12 Board', 'Backlogs', 'Applied Date'];
    const rows = [headers.join(',')];

    applicants.forEach(app => {
      const s = app.student;
      const p = s.studentProfile || {};
      const row = [
        `"${p.universityRollNumber || ''}"`,
        `"${s.name || ''}"`,
        `"${s.email || ''}"`,
        `"${p.contactNumber || ''}"`,
        `"${app.status}"`,
        `"${isStudentEligible(app) ? 'Eligible' : 'Not Eligible'}"`,
        `"${p.collegeId || ''}"`,
        `"${p.universityRegistrationNumber || ''}"`,
        `"${p.admissionType || ''}"`,
        `"${p.stream || ''}"`,
        `"${p.section || ''}"`,
        `"${p.gender || ''}"`,
        `"${p.dateOfBirth || ''}"`,
        `"${p.currentCGPA || ''}"`,
        `"${p.tenthPercentage || ''}"`,
        `"${p.twelfthPercentage || ''}"`,
        `"${(p.skills || []).join('; ')}"`,
        `"${p.tenthBoard || ''}"`,
        `"${p.twelfthBoard || ''}"`,
        `"${p.numberOfBacklog !== undefined ? p.numberOfBacklog : ''}"`,
        `"${new Date(app.appliedAt).toLocaleDateString()}"`
      ].join(',');
      rows.push(row);
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedJob?.companyName || 'company'}_applicants_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'shortlisted': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Manage Jobs</h1>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> Post Job</button>
        </div>
        {loading ? <div className="space-y-4">{[1,2].map(i => <div key={i} className="card h-20 animate-pulse"></div>)}</div> : jobs.length === 0 ? (
          <div className="card text-center py-12"><Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No jobs posted</h3></div>
        ) : (
          <div className="space-y-4">{jobs.map(job => (
            <div key={job._id} className="card flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{job.title}</h3>
                <p className="text-gray-500">{job.companyName} • {job.location}</p>
                <span className="badge badge-blue mt-1">{job.jobType}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => viewApplicants(job)} className="btn-secondary flex items-center gap-1 text-sm">
                  <Users className="w-4 h-4" /> Applicants
                </button>
                <button onClick={() => openEditModal(job)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><Edit className="w-5 h-5" /></button>
                <button onClick={() => deleteJob(job._id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
        )}
        
        {/* Applicants Modal */}
        {showApplicantsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Applicants</h2>
                  <p className="text-gray-500">{selectedJob?.title} - {selectedJob?.companyName}</p>
                </div>
                <button onClick={() => { setShowApplicantsModal(false); setSelectedJob(null); setApplicants([]); }} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>

              {applicantsLoading ? (
                <div className="text-center py-8">Loading applicants...</div>
              ) : applicants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No students have applied yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</p>
                    <button onClick={exportCSV} className="btn-secondary flex items-center gap-1 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Export CSV
                    </button>
                  </div>
                  {applicants.map((app) => (
                    <div key={app.applicationId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            {app.student.name}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isStudentEligible(app) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isStudentEligible(app) ? '✅ Eligible' : '❌ Not Eligible'}
                            </span>
                          </h3>
                          <p className="text-gray-500 text-sm">{app.student.email}</p>
                          <p className="text-gray-500 text-sm">📱 {app.student.phone || app.student.contactNumber || 'N/A'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            Applied: {new Date(app.appliedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* All Student Fields */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                          {app.student.studentProfile?.universityRollNumber && <p><span className="font-medium">University Roll:</span> {app.student.studentProfile.universityRollNumber}</p>}
                          {app.student.studentProfile?.collegeId && <p><span className="font-medium">College ID:</span> {app.student.studentProfile.collegeId}</p>}
                          {app.student.studentProfile?.stream && <p><span className="font-medium">Stream:</span> {app.student.studentProfile.stream}</p>}
                          {app.student.studentProfile?.section && <p><span className="font-medium">Section:</span> {app.student.studentProfile.section}</p>}
                          {app.student.studentProfile?.gender && <p><span className="font-medium">Gender:</span> {app.student.studentProfile.gender}</p>}
                          {app.student.studentProfile?.dateOfBirth && <p><span className="font-medium">DOB:</span> {app.student.studentProfile.dateOfBirth}</p>}
                          {app.student.studentProfile?.admissionType && <p><span className="font-medium">Admission Type:</span> {app.student.studentProfile.admissionType}</p>}
                          {app.student.studentProfile?.universityRegistrationNumber && <p><span className="font-medium">Reg. No:</span> {app.student.studentProfile.universityRegistrationNumber}</p>}
                          {app.student.studentProfile?.currentCGPA && <p><span className="font-medium">CGPA:</span> {app.student.studentProfile.currentCGPA}</p>}
                          {app.student.studentProfile?.twelfthPercentage && <p><span className="font-medium">Class 12 %:</span> {app.student.studentProfile.twelfthPercentage}</p>}
                          {app.student.studentProfile?.tenthPercentage && <p><span className="font-medium">Class 10 %:</span> {app.student.studentProfile.tenthPercentage}</p>}
                          {app.student.studentProfile?.twelfthBoard && <p><span className="font-medium">12th Board:</span> {app.student.studentProfile.twelfthBoard}</p>}
                          {app.student.studentProfile?.tenthBoard && <p><span className="font-medium">10th Board:</span> {app.student.studentProfile.tenthBoard}</p>}
                          {app.student.studentProfile?.contactNumber && <p><span className="font-medium">Contact:</span> {app.student.studentProfile.contactNumber}</p>}
                          {app.student.studentProfile?.numberOfBacklog !== undefined && <p><span className="font-medium">Backlogs:</span> {app.student.studentProfile.numberOfBacklog}</p>}
                          {app.student.studentProfile?.skills?.length > 0 && <p className="col-span-4"><span className="font-medium">Skills:</span> {app.student.studentProfile.skills.join(', ')}</p>}
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button 
                          onClick={() => updateApplicationStatus(app.applicationId, 'shortlisted')}
                          disabled={app.status === 'shortlisted'}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                        >
                          Shortlist
                        </button>
                        
                        <button 
                          onClick={() => updateApplicationStatus(app.applicationId, 'rejected')}
                          disabled={app.status === 'rejected'}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => updateApplicationStatus(app.applicationId, 'pending')}
                          disabled={app.status === 'pending'}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">{editingJob ? 'Edit Job' : 'Post New Job'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" className="input" placeholder="Job Title" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                <input type="text" className="input" placeholder="Company Name" required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} />
                <input type="text" className="input" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                <select className="input" value={form.jobType} onChange={e => setForm({...form, jobType: e.target.value})}><option value="full-time">Full Time</option><option value="internship">Internship</option><option value="part-time">Part Time</option></select>
                <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" className="input" placeholder="Min Salary (LPA)" value={form.salaryMin} onChange={e => setForm({...form, salaryMin: e.target.value})} />
                  <input type="number" step="0.01" className="input" placeholder="Max Salary (LPA)" value={form.salaryMax} onChange={e => setForm({...form, salaryMax: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Eligibility Criteria</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <input type="number" step="0.01" min="4" max="10" className="input" placeholder="MinCGPA(4-10)" value={form.eligibility.minCGPA} onChange={e => setForm({...form, eligibility: {...form.eligibility, minCGPA: e.target.value}})} />
                      <span className="text-xs text-gray-500">Min CGPA</span>
                    </div>
                    <div>
                      <input type="number" step="0.01" min="0" max="100" className="input" placeholder="Class12%" value={form.eligibility.class12Percentage} onChange={e => setForm({...form, eligibility: {...form.eligibility, class12Percentage: e.target.value}})} />
                      <span className="text-xs text-gray-500">Class 12 %</span>
                    </div>
                    <div>
                      <input type="number" step="0.01" min="0" max="100" className="input" placeholder="Class10%" value={form.eligibility.class10Percentage} onChange={e => setForm({...form, eligibility: {...form.eligibility, class10Percentage: e.target.value}})} />
                      <span className="text-xs text-gray-500">Class 10 %</span>
                    </div>
                  </div>
                </div>
                
                <input type="text" className="input" placeholder="Skills (comma-separated)" value={form.requiredSkills} onChange={e => setForm({...form, requiredSkills: e.target.value})} />
                
                <label className="block text-sm font-medium text-gray-700 mb-2">Application Deadline</label>
                <input type="date" className="input" placeholder="Application Deadline" value={form.applicationDeadline} onChange={e => setForm({...form, applicationDeadline: e.target.value})} />
                
                <div className="flex gap-4">
                  <button type="submit" className="btn-primary flex-1">{editingJob ? 'Update' : 'Post'}</button>
                  <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}