import { useState, useEffect } from 'react';
import { Plus, Trash2, Briefcase, Edit, Users, X, Bell, Calendar, FileText, Award, Mail, Star } from 'lucide-react';
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
  const [searchRoll, setSearchRoll] = useState('');

  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    type: 'general',
    title: '',
    message: '',
    metadata: {},
    eventDate: ''
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  const filteredApplicants = searchRoll
    ? applicants.filter(app =>
        app.student.studentProfile?.universityRollNumber
          ?.toLowerCase()
          .includes(searchRoll.toLowerCase())
    )
    : applicants;

  const [selectedApplicants, setSelectedApplicants] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);

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

  const [submitBtn, setSubmitBtn] = useState({ label: 'Post', error: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate all 12 fields are filled
    const missingFields = [];
    if (!form.title.trim()) missingFields.push('Job Title');
    if (!form.companyName.trim()) missingFields.push('Company Name');
    if (!form.location.trim()) missingFields.push('Location');
    if (!form.jobType.trim()) missingFields.push('Job Type');
    if (!form.description.trim()) missingFields.push('Description');
    if (!form.salaryMin.trim()) missingFields.push('Min Salary (LPA)');
    if (!form.salaryMax.trim()) missingFields.push('Max Salary (LPA)');
    if (!form.eligibility.minCGPA.trim()) missingFields.push('Min CGPA');
    if (!form.eligibility.class12Percentage.trim()) missingFields.push('Class 12 %');
    if (!form.eligibility.class10Percentage.trim()) missingFields.push('Class 10 %');
    if (!form.requiredSkills.trim()) missingFields.push('Required Skills');
    if (!form.applicationDeadline.trim()) missingFields.push('Application Deadline');

    if (missingFields.length > 0) {
      setSubmitBtn({ label: 'Fill All Fields', error: true });
      setTimeout(() => setSubmitBtn({ label: editingJob ? 'Update' : 'Post', error: false }), 1500);
      return;
    }

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

  const getEligibilityFailure = (app) => {
    if (!selectedJob?.eligibility) return null;
    const el = selectedJob.eligibility;
    const sp = app.student.studentProfile || {};

    const cgpa = sp.currentCGPA ?? app.student.cgpa;
    const cls12 = sp.twelfthPercentage ?? app.student.class12Percentage;
    const cls10 = sp.tenthPercentage ?? app.student.class10Percentage;

    const failures = [];
    if (el.minCGPA !== undefined && (cgpa === undefined || cgpa === null || cgpa < el.minCGPA)) failures.push('cgpa');
    if (el.class12Percentage !== undefined && (cls12 === undefined || cls12 === null || cls12 < el.class12Percentage)) failures.push('cls12');
    if (el.class10Percentage !== undefined && (cls10 === undefined || cls10 === null || cls10 < el.class10Percentage)) failures.push('cls10');

    return failures.length > 0 ? failures : null;
  };

  const isStudentEligible = (app) => getEligibilityFailure(app) === null;

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
    const headers = ['University Roll', 'Name', 'Email', 'Phone', 'Status', 'Eligibility', 'College ID', 'Reg. No', 'Admission Type', 'Graduation Year', 'Stream', 'Section', 'Gender', 'DOB', 'CGPA', 'Class 10 %', 'Class 12 %', 'Skills', 'Class 10 Board', 'Class 12 Board', 'Backlogs', 'Applied Date'];
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
        `"${p.graduationPassingYear || ''}"`,
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

  // Notification target state
  const [notificationTarget, setNotificationTarget] = useState({ applicationId: null, studentId: null });

  // Open notification modal for a student
  const openNotificationModal = (app) => {
    setNotificationForm({
      type: 'general',
      title: '',
      message: '',
      metadata: {},
      eventDate: ''
    });
    setNotificationTarget({ applicationId: app.applicationId, studentId: app.student._id });
    setShowNotificationModal(true);
  };

  // Open bulk notification modal for selected students
  const openBulkNotificationModal = () => {
    setNotificationForm({
      type: 'general',
      title: '',
      message: '',
      metadata: {},
      eventDate: ''
    });
    setNotificationTarget({ applicationIds: selectedApplicants, studentId: null });
    setShowNotificationModal(true);
  };

  // Handle notification type change
  const handleNotificationTypeChange = (type) => {
    setNotificationForm(prev => ({
      ...prev,
      type,
      title: getDefaultTitle(type),
      metadata: {}
    }));
  };

  // Get default title based on type
  const getDefaultTitle = (type) => {
    switch (type) {
      case 'interview': return 'Interview Scheduled';
      case 'exam': return 'Exam Scheduled';
      case 'offer_letter': return 'Selected for the Job';
      case 'rejection': return 'Application Rejected';
      case 'shortlist': return 'Application Shortlisted';
      default: return '';
    }
  };

  // Send notification
  const sendNotification = async (e) => {
    e.preventDefault();
    if (!notificationForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!notificationTarget.studentId && !notificationTarget.applicationIds?.length) {
      toast.error('No student selected');
      return;
    }

    setSendingNotification(true);
    try {
      const isBulk = !!notificationTarget.applicationIds;
      const payload = {
        studentId: notificationTarget.studentId,
        jobId: selectedJob?._id,
        applicationId: notificationTarget.applicationId,
        applicationIds: notificationTarget.applicationIds,
        type: notificationForm.type,
        title: notificationForm.title,
        message: notificationForm.message,
        metadata: notificationForm.metadata,
        eventDate: notificationForm.eventDate || null
      };

      const endpoint = isBulk ? `${API_URL}/api/notifications/send-bulk` : `${API_URL}/api/notifications/send`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        toast.success(isBulk ? `Notification sent to ${notificationTarget.applicationIds.length} students!` : 'Notification sent!');
        setShowNotificationModal(false);
        setNotificationForm({ type: 'general', title: '', message: '', metadata: {}, eventDate: '' });
        setSelectedApplicants([]);
        setBulkMode(false);
        // Refresh applicants list to show updated status
        if (selectedJob?._id) viewApplicants(selectedJob);
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    } catch (error) {
      toast.error('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'shortlisted': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Manage Jobs</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/officer/dashboard'} className="btn-secondary flex items-center gap-2"><Briefcase className="w-5 h-5" /> Back to Dashboard</button>
            <button onClick={openCreateModal} className="btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> Post Job</button>
          </div>
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
                <button onClick={() => { setShowApplicantsModal(false); setSelectedJob(null); setApplicants([]); setSearchRoll(''); setSelectedApplicants([]); setBulkMode(false); }} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
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
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Search by University Roll..."
                        value={searchRoll}
                        onChange={e => setSearchRoll(e.target.value)}
                        className="input text-sm py-1.5 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                      />
                      {searchRoll && (
                        <button onClick={() => setSearchRoll('')} className="text-gray-400 hover:text-gray-600 text-sm">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-500">
                        {searchRoll ? `${filteredApplicants.length} of ${applicants.length}` : `${filteredApplicants.length}`} applicant{filteredApplicants.length !== 1 ? 's' : ''}
                        {selectedApplicants.length > 0 && <span className="ml-1 text-purple-600 font-medium">({selectedApplicants.length} selected)</span>}
                      </p>
                      {bulkMode ? (
                        <div className="flex items-center gap-2">
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowSelectDropdown(!showSelectDropdown); }}
                              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium border border-purple-300 hover:border-purple-500 rounded-md px-2.5 py-1 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                              Select
                              <svg className={`w-3 h-3 transition-transform duration-150 ${showSelectDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {showSelectDropdown && (
                              <div className="absolute z-20 mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-44 animate-dropdown">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedApplicants(filteredApplicants.map(a => a.applicationId)); setShowSelectDropdown(false); }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedApplicants(filteredApplicants.filter(a => isStudentEligible(a)).map(a => a.applicationId)); setShowSelectDropdown(false); }}
                                  className="w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50"
                                >
                                  Select All Eligible
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedApplicants(filteredApplicants.filter(a => !isStudentEligible(a)).map(a => a.applicationId)); setShowSelectDropdown(false); }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                                >
                                  Select All Not Eligible
                                </button>
                                <div className="border-t border-gray-100" />
                                <button
                                  type="button"
                                  onClick={() => { setSelectedApplicants([]); setBulkMode(false); setShowSelectDropdown(false); }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBulkMode(true)}
                          className="btn-secondary flex items-center gap-1 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          Bulk Select
                        </button>
                      )}
                      <button onClick={exportCSV} className="btn-secondary flex items-center gap-1 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Export CSV
                      </button>
                    </div>
                  </div>
                  {bulkMode && selectedApplicants.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm text-purple-700">
                        {selectedApplicants.length} student{selectedApplicants.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => openBulkNotificationModal()}
                        className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex items-center gap-1"
                      >
                        <Bell className="w-4 h-4" />
                        Send Bulk Notification
                      </button>
                    </div>
                  )}
                  {filteredApplicants.length === 0 && searchRoll ? (
                    <div className="text-center py-8 text-gray-500">No applicant found with roll: {searchRoll}</div>
                  ) : (
                    filteredApplicants.map((app) => {
                      const failures = getEligibilityFailure(app);
                      return (
                        <div key={app.applicationId} className={`border rounded-lg p-4 ${bulkMode && selectedApplicants.includes(app.applicationId) ? 'border-purple-400 bg-purple-50' : ''}`}>
                          <div className="flex items-start justify-between mb-3">
                            {bulkMode && (
                              <input
                                type="checkbox"
                                checked={selectedApplicants.includes(app.applicationId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedApplicants(prev => [...prev, app.applicationId]);
                                  } else {
                                    setSelectedApplicants(prev => prev.filter(id => id !== app.applicationId));
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                              />
                            )}
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
                              {app.student.studentProfile?.graduationPassingYear && <p><span className="font-medium">Graduation Year:</span> {app.student.studentProfile.graduationPassingYear}</p>}
                              {app.student.studentProfile?.universityRegistrationNumber && <p><span className="font-medium">Reg. No:</span> {app.student.studentProfile.universityRegistrationNumber}</p>}
                              {(() => {
                                const sp = app.student.studentProfile || {};
                                const val = sp.currentCGPA ?? app.student.cgpa;
                                const req = selectedJob?.eligibility?.minCGPA;
                                const failed = failures?.includes('cgpa');
                                return <p className={failed ? 'text-red-600 font-medium' : ''}><span className="font-medium">CGPA:</span> {val ?? 'N/A'}{req !== undefined ? ` (required: ${req})` : ''}</p>;
                              })()}
                              {(() => {
                                const sp = app.student.studentProfile || {};
                                const val = sp.twelfthPercentage ?? app.student.class12Percentage;
                                const req = selectedJob?.eligibility?.class12Percentage;
                                const failed = failures?.includes('cls12');
                                return <p className={failed ? 'text-red-600 font-medium' : ''}><span className="font-medium">Class 12 %:</span> {val ?? 'N/A'}{req !== undefined ? ` (required: ${req})` : ''}</p>;
                              })()}
                              {(() => {
                                const sp = app.student.studentProfile || {};
                                const val = sp.tenthPercentage ?? app.student.class10Percentage;
                                const req = selectedJob?.eligibility?.class10Percentage;
                                const failed = failures?.includes('cls10');
                                return <p className={failed ? 'text-red-600 font-medium' : ''}><span className="font-medium">Class 10 %:</span> {val ?? 'N/A'}{req !== undefined ? ` (required: ${req})` : ''}</p>;
                              })()}
                              {app.student.studentProfile?.twelfthBoard && <p><span className="font-medium">12th Board:</span> {app.student.studentProfile.twelfthBoard}</p>}
                              {app.student.studentProfile?.tenthBoard && <p><span className="font-medium">10th Board:</span> {app.student.studentProfile.tenthBoard}</p>}
                              {app.student.studentProfile?.contactNumber && <p><span className="font-medium">Contact:</span> {app.student.studentProfile.contactNumber}</p>}
                              {app.student.studentProfile?.numberOfBacklog !== undefined && <p><span className="font-medium">Backlogs:</span> {app.student.studentProfile.numberOfBacklog}</p>}
                              {app.student.studentProfile?.skills?.length > 0 && <p className="col-span-4"><span className="font-medium">Skills:</span> {app.student.studentProfile.skills.join(', ')}</p>}
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2 flex-wrap">
                            {/* Send Notification Button */}
                            <button
                              onClick={() => openNotificationModal(app)}
                              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1"
                            >
                              <Bell className="w-4 h-4" />
                              Send Notification
                            </button>

                            {/* Reset Button */}
                            <button
                              onClick={() => updateApplicationStatus(app.applicationId, 'pending')}
                              disabled={app.status === 'pending'}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">{editingJob ? 'Edit Job' : 'Post New Job'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <input type="text" className="input" placeholder="Job Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
                <input type="text" className="input" placeholder="Company Name" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} />
                <input type="text" className="input" placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                <select className="input" value={form.jobType} onChange={e => setForm({...form, jobType: e.target.value})}><option value="full-time">Full Time</option><option value="internship">Internship</option><option value="part-time">Part Time</option></select>
                <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="Min Salary (LPA)" value={form.salaryMin} onChange={e => setForm({...form, salaryMin: e.target.value})} />
                  <input type="number" step="0.01" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="Max Salary (LPA)" value={form.salaryMax} onChange={e => setForm({...form, salaryMax: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Eligibility Criteria</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <input type="number" step="0.01" min="4" max="10" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="MinCGPA(4-10)" value={form.eligibility.minCGPA} onChange={e => setForm({...form, eligibility: {...form.eligibility, minCGPA: e.target.value}})} />
                      <span className="text-xs text-gray-500">Min CGPA</span>
                    </div>
                    <div>
                      <input type="number" step="0.01" min="0" max="100" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="Class12%" value={form.eligibility.class12Percentage} onChange={e => setForm({...form, eligibility: {...form.eligibility, class12Percentage: e.target.value}})} />
                      <span className="text-xs text-gray-500">Class 12 %</span>
                    </div>
                    <div>
                      <input type="number" step="0.01" min="0" max="100" className="input [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="Class10%" value={form.eligibility.class10Percentage} onChange={e => setForm({...form, eligibility: {...form.eligibility, class10Percentage: e.target.value}})} />
                      <span className="text-xs text-gray-500">Class 10 %</span>
                    </div>
                  </div>
                </div>
                
                <input type="text" className="input" placeholder="Skills (comma-separated)" value={form.requiredSkills} onChange={e => setForm({...form, requiredSkills: e.target.value})} />
                
                <label className="block text-sm font-medium text-gray-700 mb-2">Application Deadline</label>
                <input type="date" className="input" placeholder="Application Deadline" value={form.applicationDeadline} onChange={e => setForm({...form, applicationDeadline: e.target.value})} />
                
                <div className="flex gap-4">
                  <button type="submit" className={`flex-1 ${submitBtn.error ? 'bg-red-500 text-white' : 'btn-primary'}`}>{submitBtn.label}</button>
                  <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Send Notification Modal */}
        {showNotificationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-600" />
                  {notificationTarget.applicationIds ? 'Bulk Notification' : 'Send Notification'}
                  {notificationTarget.applicationIds && (
                    <span className="text-sm font-normal text-gray-500">
                      ({notificationTarget.applicationIds.length} students)
                    </span>
                  )}
                </h2>
                <button onClick={() => { setShowNotificationModal(false); setSelectedApplicants([]); setBulkMode(false); }} className="p-2 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={sendNotification} className="space-y-4">
                {/* Notification Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notification Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'interview', label: ' Interview', icon: Calendar },
                      { value: 'exam', label: ' Exam', icon: FileText },
                      { value: 'offer_letter', label: ' Selection', icon: Award },
                      { value: 'rejection', label: ' Rejection', icon: X },
                      { value: 'shortlist', label: ' Shortlisted', icon: Star },
                      { value: 'general', label: ' General', icon: Mail }
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleNotificationTypeChange(value)}
                        className={`px-3 py-2 text-sm rounded-lg border-2 transition-all flex items-center justify-center gap-1 ${
                          notificationForm.type === value 
                            ? 'border-purple-500 bg-purple-50 text-purple-700' 
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Fields Based on Type */}
                {notificationForm.type === 'interview' && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Interview Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Date</label>
                        <input
                          type="date"
                          className="input text-sm"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, interviewDate: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Time</label>
                        <input
                          type="time"
                          className="input text-sm"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, interviewTime: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Location / Link</label>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Conference Room or Meeting Link"
                        onChange={e => setNotificationForm(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, interviewLocation: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Mode</label>
                      <select
                        className="input text-sm"
                        onChange={e => setNotificationForm(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, interviewMode: e.target.value }
                        }))}
                      >
                        <option value="">Select Mode</option>
                        <option value="virtual">Virtual</option>
                        <option value="in-person">In-Person</option>
                        <option value="phone">Phone</option>
                      </select>
                    </div>
                  </div>
                )}

                {notificationForm.type === 'exam' && (
                  <div className="space-y-3 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Exam Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Date</label>
                        <input
                          type="date"
                          className="input text-sm"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, examDate: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Time</label>
                        <input
                          type="time"
                          className="input text-sm"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, examTime: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Duration</label>
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder="e.g., 2 hours"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, examDuration: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Mode</label>
                        <select
                          className="input text-sm"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, examMode: e.target.value }
                          }))}
                        >
                          <option value="">Select</option>
                          <option value="online">Online</option>
                          <option value="offline">Offline</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Location (if offline)</label>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Exam center location"
                        onChange={e => setNotificationForm(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, examLocation: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                )}

                {notificationForm.type === 'offer_letter' && (
                  <div className="space-y-3 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Offer Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">CTC (₹)</label>
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder="e.g., 8 LPA"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, ctc: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Role</label>
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder="Job role"
                          onChange={e => setNotificationForm(prev => ({
                            ...prev,
                            metadata: { ...prev.metadata, role: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    
                    
                  </div>
                )}

                {notificationForm.type === 'rejection' && (
                  <div className="space-y-3 p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 flex items-center gap-2">
                      <X className="w-4 h-4" /> Rejection Details
                    </h4>
                    <div>
                      <label className="text-xs text-gray-600">Reason (Optional)</label>
                      <textarea
                        className="input text-sm"
                        rows={3}
                        placeholder="Optional feedback for the student..."
                        onChange={e => setNotificationForm(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, reason: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                )}

                {/* Shortlist fields */}

                {/* Common Fields: Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Notification title"
                    value={notificationForm.title}
                    onChange={e => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                {/* Event Date - for student timeline tracking */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">📅 Event Date</label>
                  <input
                    type="date"
                    className="input"
                    value={notificationForm.eventDate || ''}
                    onChange={e => setNotificationForm(prev => ({ ...prev, eventDate: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">This date will be shown in the student's application timeline</p>
                </div>

                {/* Common Fields: Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message (Optional)</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Additional message or notes..."
                    value={notificationForm.message}
                    onChange={e => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={sendingNotification}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {sendingNotification ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        Send Notification
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotificationModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}