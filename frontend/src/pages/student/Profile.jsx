import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save, X, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { STREAM_OPTIONS, SECTION_OPTIONS, YEAR_OPTIONS } from '../../lib/profileOptions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [formatError, setFormatError] = useState(null); // { field, message } | null
  const formRef = useRef(null); // used to scroll the page back to the error banner on submit/catch

  // Field labels for the "fill all the fields" message
  const FIELD_LABELS = {
    universityRollNumber: 'University Roll Number',
    universityRegistrationNumber: 'University Registration Number',
    collegeId: 'College ID',
    admissionType: 'Admission Type',
    fullName: 'Full Name',
    stream: 'Stream',
    section: 'Section',
    gender: 'Gender',
    dateOfBirth: 'Date of Birth',
    contactNumber: 'Contact Number',
    email: 'Email',
    graduationPassingYear: 'Graduation Passing Year',
    tenthBoard: '10th Board',
    tenthPercentage: '10th Percentage',
    tenthPassingYear: '10th Passing Year',
    twelfthBoard: '12th Board',
    twelfthPercentage: '12th Percentage',
    twelfthPassingYear: '12th Passing Year',
    currentCGPA: 'Current CGPA',
    numberOfBacklog: 'Number of Backlogs'
  };
  const [isModified, setIsModified] = useState(false);
  const [form, setForm] = useState({
    universityRollNumber: '',
    universityRegistrationNumber: '',
    collegeId: '',
    admissionType: '',
    fullName: '',
    stream: '',
    section: '',
    gender: '',
    dateOfBirth: '',
    tenthBoard: '',
    tenthMedium: '',
    tenthPercentage: '',
    tenthPassingYear: '',
    twelfthBoard: '',
    twelfthMedium: '',
    twelfthPercentage: '',
    twelfthPassingYear: '',
    contactNumber: '',
    currentCGPA: '',
    numberOfBacklog: '',
    graduationPassingYear: '',
    skills: '',
  });

  // Fetch latest profile data when component mounts
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const fullUser = res.data.data.user;
        setForm({
          universityRollNumber: fullUser.studentProfile?.universityRollNumber || '',
          universityRegistrationNumber: fullUser.studentProfile?.universityRegistrationNumber || '',
          collegeId: fullUser.studentProfile?.collegeId || '',
          admissionType: fullUser.studentProfile?.admissionType || '',
          fullName: fullUser.studentProfile?.fullName || fullUser.name || '',
          stream: fullUser.studentProfile?.stream || '',
          section: fullUser.studentProfile?.section || '',
          gender: fullUser.studentProfile?.gender || '',
          dateOfBirth: fullUser.studentProfile?.dateOfBirth || '',
          tenthBoard: fullUser.studentProfile?.tenthBoard || '',
          tenthMedium: fullUser.studentProfile?.tenthMedium || '',
          tenthPercentage: fullUser.studentProfile?.tenthPercentage || '',
          tenthPassingYear: fullUser.studentProfile?.tenthPassingYear || '',
          twelfthBoard: fullUser.studentProfile?.twelfthBoard || '',
          twelfthMedium: fullUser.studentProfile?.twelfthMedium || '',
          twelfthPercentage: fullUser.studentProfile?.twelfthPercentage || '',
          twelfthPassingYear: fullUser.studentProfile?.twelfthPassingYear || '',
          contactNumber: fullUser.studentProfile?.contactNumber || '',
          email: fullUser.studentProfile?.email || fullUser.email || '',
          currentCGPA: fullUser.studentProfile?.currentCGPA || '',
          numberOfBacklog: fullUser.studentProfile?.numberOfBacklog ?? '',
          graduationPassingYear: fullUser.studentProfile?.graduationPassingYear || '',
          skills: fullUser.studentProfile?.skills?.join(', ') || '',
        });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (field, value) => {
    // Auto-uppercase for full name
    if (field === 'fullName') {
      value = value.toUpperCase();
    }
    // Auto-uppercase for college ID, force DSC + 8 digits
    if (field === 'collegeId') {
      // Strip the DSC prefix if user typed it, plus any non-digits
      let digits = String(value).replace(/^DSC/i, '').replace(/\D/g, '').slice(0, 8);
      value = 'DSC' + digits;
    }
    // Only keep digits for contact number
    if (field === 'contactNumber') {
      value = value.replace(/[^0-9]/g, '');
    }
    // If backlog is selected, clear CGPA and set to 0
    if (field === 'numberOfBacklog') {
      if (value !== '' && parseInt(value) > 0) {
        setForm(prev => ({ ...prev, [field]: value, currentCGPA: '' }));
        setIsModified(true);
        return;
      }
    }
    // CGPA: strip non-digits-except-dot, keep at most 2 decimal places (live)
    if (field === 'currentCGPA') {
      let v = String(value).replace(/[^0-9.]/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      const dotIdx = v.indexOf('.');
      if (dotIdx !== -1 && v.length - dotIdx - 1 > 2) v = v.slice(0, dotIdx + 3);
      if (v.length > 5) v = v.slice(0, 5); // 2 digits + . + 2 digits max
      if (formatError && formatError.field === 'currentCGPA') setFormatError(null);
      setForm({ ...form, currentCGPA: v });
      setIsModified(true);
      return;
    }
    // Clear format error for this field if user is editing it
    if (formatError && formatError.field === field) {
      setFormatError(null);
    }
    setForm({ ...form, [field]: value });
    setIsModified(true);
  };

  // Scroll the page so the error banner (top of form) is visible.
  // Used after any submit-time validation failure so the user always sees
  // the banner, even if they were scrolled to the bottom of the form.
  // Runs after a tick so React has flushed the banner into the DOM first.
  const scrollToErrorBanner = () => {
    setTimeout(() => {
      const banner = document.getElementById('profile-error-banner');
      if (banner) {
        banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  };

  // Backlog check that uses the LATEST form state, not the stale closure copy.
  // Used by validators that run before the submit `try` block rebuilds `hasBacklog`.
  const hasBacklogField = () => form.numberOfBacklog !== '' && parseInt(form.numberOfBacklog) > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMissingFields([]);
    setFormatError(null);
    // STEP 1: Check ALL fields are present first — missing-fields banner wins
    const requiredFields = [
      'universityRollNumber', 'universityRegistrationNumber', 'collegeId', 'admissionType',
      'fullName', 'stream', 'section', 'gender', 'dateOfBirth',
      'tenthBoard', 'tenthPercentage', 'tenthPassingYear',
      'twelfthBoard', 'twelfthPercentage', 'twelfthPassingYear',
      'contactNumber', 'currentCGPA', 'numberOfBacklog', 'graduationPassingYear'
    ];
    const absent = requiredFields.filter(f => {
      const v = form[f];
      return v === '' || v === null || v === undefined;
    });
    if (absent.length > 0) {
      setMissingFields(absent);
      scrollToErrorBanner();
      const labels = absent.map(f => FIELD_LABELS[f] || f).join(', ');
      toast.error(`Please fill all fields for verification. Missing: ${labels}`, { autoClose: 6000 });
      const firstAbsent = absent[0];
      const el = document.querySelector(`[name="${firstAbsent}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    // STEP 2: All fields present — now check format of filled values
    if (form.universityRollNumber.length !== 11) {
      const err = { field: 'universityRollNumber', message: 'Input your 11 digit roll number' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="universityRollNumber"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    if (form.universityRegistrationNumber.length !== 12) {
      const err = { field: 'universityRegistrationNumber', message: 'Input your 12 digit registration number' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="universityRegistrationNumber"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    if (form.contactNumber.length !== 10) {
      const err = { field: 'contactNumber', message: 'Contact Number must be exactly 10 digits' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="contactNumber"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    if (!/^DSC\d{8}$/.test(form.collegeId)) {
      const err = { field: 'collegeId', message: 'College ID must be DSC followed by 8 digits' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="collegeId"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    // 10th & 12th percentage must be 30 ≤ value ≤ 100
    const tenthPct = parseFloat(form.tenthPercentage);
    if (isNaN(tenthPct) || tenthPct < 30 || tenthPct > 100) {
      const err = { field: 'tenthPercentage', message: '10th Percentage must be between 30 and 100' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="tenthPercentage"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    const twelfthPct = parseFloat(form.twelfthPercentage);
    if (isNaN(twelfthPct) || twelfthPct < 30 || twelfthPct > 100) {
      const err = { field: 'twelfthPercentage', message: '12th Percentage must be between 30 and 100' };
      setFormatError(err);
      scrollToErrorBanner();
      toast.error(err.message, { autoClose: 5000 });
      const el = document.querySelector('[name="twelfthPercentage"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
      setLoading(false);
      return;
    }
    // CGPA range check (skipped when backlog is selected — backlog forces CGPA=0)
    if (!hasBacklogField()) {
      const cgpa = parseFloat(form.currentCGPA);
      if (isNaN(cgpa) || cgpa < 4 || cgpa > 10) {
        const err = { field: 'currentCGPA', message: 'CGPA must be between 4 and 10' };
        setFormatError(err);
        scrollToErrorBanner();
        toast.error(err.message, { autoClose: 5000 });
        const el = document.querySelector('[name="currentCGPA"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
        setLoading(false);
        return;
      }
    }

    try {
      const hasBacklog = form.numberOfBacklog !== '' && parseInt(form.numberOfBacklog) > 0;
      const res = await updateProfile({
        studentProfile: {
          ...user.studentProfile,
          ...form,
          tenthPercentage: form.tenthPercentage ? parseFloat(parseFloat(form.tenthPercentage).toFixed(2)) : undefined,
          twelfthPercentage: form.twelfthPercentage ? parseFloat(parseFloat(form.twelfthPercentage).toFixed(2)) : undefined,
          currentCGPA: hasBacklog ? 0 : (form.currentCGPA ? parseFloat(parseFloat(form.currentCGPA).toFixed(2)) : undefined),
          numberOfBacklog: form.numberOfBacklog !== '' ? parseInt(form.numberOfBacklog) : undefined,
          tenthPassingYear: form.tenthPassingYear ? parseInt(form.tenthPassingYear) : undefined,
          twelfthPassingYear: form.twelfthPassingYear ? parseInt(form.twelfthPassingYear) : undefined,
          graduationPassingYear: form.graduationPassingYear ? parseInt(form.graduationPassingYear) : undefined,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        }
      });
      const isComplete = res?.data?.user?.studentProfile?.isProfileComplete;
      if (isComplete) {
        toast.success('Profile saved! Sent for verification.');
      } else {
        toast.success('Draft saved. Please complete remaining fields for verification.');
      }
      setSaved(true);
      setIsModified(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      // Backend rejects first-save with 400 + missingFields list when something is empty
      if (error.response?.status === 400 && error.response?.data?.code === 'PROFILE_INCOMPLETE') {
        const missing = error.response.data.missingFields || [];
        setMissingFields(missing);
        scrollToErrorBanner();
        const labels = missing.map(f => FIELD_LABELS[f] || f).join(', ');
        toast.error(`Please fill all fields for verification. Missing: ${labels}`, { autoClose: 6000 });
        // Scroll to the first missing field so the student sees it
        const firstMissing = missing[0];
        if (firstMissing) {
          const el = document.querySelector(`[name="${firstMissing}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus({ preventScroll: true });
          }
        }
      } else if (error.response?.status === 400 && error.response?.data?.code === 'PROFILE_INVALID') {
        // Format error (e.g. roll number not 11 digits) — show friendly banner + highlight offending field
        const formatErrors = error.response.data.formatErrors || [];
        const firstField = formatErrors[0]?.match(/^(\w+)/)?.[1];
        // Friendly message override for the numeric fields
        let message = error.response.data.message || 'Profile contains invalid data';
        if (firstField === 'universityRollNumber') message = 'Input your 11 digit roll number';
        if (firstField === 'universityRegistrationNumber') message = 'Input your 12 digit registration number';
        if (firstField === 'contactNumber') message = 'Contact Number must be exactly 10 digits';
        if (firstField === 'collegeId') message = 'College ID must be DSC followed by 8 digits';
        if (firstField === 'tenthPercentage') message = '10th Percentage must be between 30 and 100';
        if (firstField === 'twelfthPercentage') message = '12th Percentage must be between 30 and 100';
        if (firstField === 'currentCGPA') message = 'CGPA must be between 4 and 10';
        if (firstField) setFormatError({ field: firstField, message });
        scrollToErrorBanner();
        toast.error(message, { autoClose: 5000 });
        if (firstField) {
          const el = document.querySelector(`[name="${firstField}"]`);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
        }
      } else if (error.response?.status === 409 && error.response?.data?.code === 'DUPLICATE_PROFILE_FIELD') {
        // Duplicate roll / reg / collegeId — highlight the conflicting field in red and show a clear message
        const fieldRaw = error.response.data.field || '';
        const fieldKey = fieldRaw === 'University Roll Number' ? 'universityRollNumber'
          : fieldRaw === 'University Registration Number' ? 'universityRegistrationNumber'
          : fieldRaw === 'College ID' ? 'collegeId'
          : null;
        const message = error.response.data.message || 'This field is already used by another student.';
        if (fieldKey) {
          setFormatError({ field: fieldKey, message });
          scrollToErrorBanner();
          const el = document.querySelector(`[name="${fieldKey}"]`);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
        }
        toast.error(message, { autoClose: 6000 });
      } else {
        toast.error(error.response?.data?.message || 'Failed to update profile');
      }
    }
    finally { setLoading(false); }
  };

  const hasBacklog = form.numberOfBacklog !== '' && parseInt(form.numberOfBacklog) > 0;

  // Header shows the latest saved profile name/email (form state) — falls back
  // to the auth-user values (Gmail-derived) only when the student hasn't
  // filled their profile yet, so freshly-onboarded users still see something.
  const displayName = form.fullName || user?.name;
  const displayEmail = user?.email;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-medium rounded-lg transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
        <div className="card mb-6">
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center dark:bg-blue-900/40">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{displayName?.[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{displayName}</h2>
              <p className="text-gray-500 dark:text-gray-400">{displayEmail}</p>
              <span className="badge badge-blue mt-1">{user?.role}</span>
            </div>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {(formatError || missingFields.length > 0) && (
            // Wrapper div lets handleSubmit scroll to a stable id regardless of
            // which banner (missing-fields red or format yellow) is visible.
            <div id="profile-error-banner" className="space-y-3">
              {formatError && (
                <div className="bg-yellow-50 border border-yellow-400 text-yellow-900 px-4 py-3 rounded-lg flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="font-semibold">{formatError.message}</p>
                </div>
              )}
              {missingFields.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-semibold">Please fill all required fields before saving for verification.</p>
                    <p className="text-sm mt-1">
                      Missing: {missingFields.map(f => FIELD_LABELS[f] || f).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Personal Information */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">University Roll Number <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="numeric" name="universityRollNumber" className={`input ${missingFields.includes('universityRollNumber') || formatError?.field === 'universityRollNumber' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="Roll Number" value={form.universityRollNumber} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 11); handleChange('universityRollNumber', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} maxLength={11} pattern="\d{11}" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">University Registration Number <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="numeric" name="universityRegistrationNumber" className={`input ${missingFields.includes('universityRegistrationNumber') || formatError?.field === 'universityRegistrationNumber' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="Registration Number" value={form.universityRegistrationNumber} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 12); handleChange('universityRegistrationNumber', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">College ID <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" name="collegeId" className={`input ${missingFields.includes('collegeId') || formatError?.field === 'collegeId' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="DSC12345678" value={form.collegeId} onChange={e => handleChange('collegeId', e.target.value)} maxLength={11} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admission Type <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="admissionType" className={`input ${missingFields.includes('admissionType') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.admissionType} onChange={e => handleChange('admissionType', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Regular 4-year">Regular 4-year</option>
                  <option value="Lateral 3-year">Lateral 3-year</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Full Name (Block Letters) <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" name="fullName" className={`input ${missingFields.includes('fullName') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="Enter your full name" value={form.fullName} onChange={e => handleChange('fullName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stream <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="stream" className={`input ${missingFields.includes('stream') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.stream} onChange={e => handleChange('stream', e.target.value)}>
                  <option value="">Select Stream</option>
                  {STREAM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Section <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="section" className={`input ${missingFields.includes('section') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.section} onChange={e => handleChange('section', e.target.value)}>
                  <option value="">Select Section</option>
                  {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="gender" className={`input ${missingFields.includes('gender') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="date" name="dateOfBirth" className={`input ${missingFields.includes('dateOfBirth') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.dateOfBirth} onChange={e => handleChange('dateOfBirth', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Number <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="tel" name="contactNumber" className={`input ${missingFields.includes('contactNumber') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="9876543210" value={form.contactNumber} onChange={e => handleChange('contactNumber', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Email</label>
                <input type="email" className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed" value={user?.email || ''} readOnly disabled />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email is set during signup and cannot be changed here.</p>
              </div>
            </div>
          </div>

          {/* 10th Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">10th Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="tenthBoard" className={`input ${missingFields.includes('tenthBoard') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.tenthBoard} onChange={e => handleChange('tenthBoard', e.target.value)}>
                  <option value="">Select Board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State board">State board</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Medium <span className="text-red-500 dark:text-red-400">*</span></label>
                <select className="input" value={form.tenthMedium} onChange={e => handleChange('tenthMedium', e.target.value)}>
                  <option value="">Select Medium</option>
                  <option value="bengali">Bengali</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Percentage<span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="decimal" step="0.01" name="tenthPercentage" className={`input ${missingFields.includes('tenthPercentage') || formatError?.field === 'tenthPercentage' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="Percentage" value={form.tenthPercentage} onChange={e => { let v = e.target.value.replace(/[^0-9.]/g, ''); const firstDot = v.indexOf('.'); if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, ''); if (v.length > 5) v = v.slice(0, 5); handleChange('tenthPercentage', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Passing Year <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="numeric" name="tenthPassingYear" className={`input ${missingFields.includes('tenthPassingYear') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="YYYY" value={form.tenthPassingYear} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); handleChange('tenthPassingYear', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} maxLength={4} />
              </div>
            </div>
          </div>

          {/* 12th Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">12th Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board <span className="text-red-500 dark:text-red-400">*</span></label>
                <select name="twelfthBoard" className={`input ${missingFields.includes('twelfthBoard') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.twelfthBoard} onChange={e => handleChange('twelfthBoard', e.target.value)}>
                  <option value="">Select Board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ISC">ISC</option>
                  <option value="State board">State board</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Medium <span className="text-red-500 dark:text-red-400">*</span></label>
                <select className="input" value={form.twelfthMedium} onChange={e => handleChange('twelfthMedium', e.target.value)}>
                  <option value="">Select Medium</option>
                  <option value="bengali">Bengali</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Percentage<span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="decimal" step="0.01" name="twelfthPercentage" className={`input ${missingFields.includes('twelfthPercentage') || formatError?.field === 'twelfthPercentage' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="Percentage" value={form.twelfthPercentage} onChange={e => { let v = e.target.value.replace(/[^0-9.]/g, ''); const firstDot = v.indexOf('.'); if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, ''); if (v.length > 5) v = v.slice(0, 5); handleChange('twelfthPercentage', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Passing Year <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="text" inputMode="numeric" name="twelfthPassingYear" className={`input ${missingFields.includes('twelfthPassingYear') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} placeholder="YYYY" value={form.twelfthPassingYear} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); handleChange('twelfthPassingYear', v); }} onWheel={e => e.target.blur()} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }} maxLength={4} />
              </div>
            </div>
          </div>

          {/* Academic & Skills */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Academic & Skills</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Current CGPA
                  {hasBacklog && <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(N/A — has backlog)</span>}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="currentCGPA"
                  className={`input ${hasBacklog ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''} ${missingFields.includes('currentCGPA') || formatError?.field === 'currentCGPA' ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`}
                  placeholder={hasBacklog ? 'N/A' : '0.00'}
                  value={form.currentCGPA}
                  onChange={e => handleChange('currentCGPA', e.target.value)}
                  onWheel={e => e.target.blur()}
                  onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                  disabled={hasBacklog}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Backlog</label>
                <select name="numberOfBacklog" className={`input ${missingFields.includes('numberOfBacklog') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.numberOfBacklog} onChange={e => handleChange('numberOfBacklog', e.target.value)}>
                  <option value="">Select</option>
                  {[...Array(11)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Graduation Passing Year</label>
                <select name="graduationPassingYear" className={`input ${missingFields.includes('graduationPassingYear') ? 'border-red-500 ring-2 ring-red-200 dark:border-red-500 dark:ring-red-900/40' : ''}`} value={form.graduationPassingYear} onChange={e => handleChange('graduationPassingYear', e.target.value)}>
                  <option value="">Select Year</option>
                  {YEAR_OPTIONS.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Skills (comma-separated)</label>
                <input type="text" className="input" placeholder="Python, React, Java" value={form.skills} onChange={e => handleChange('skills', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || saved || !isModified}
              className={`btn-primary w-[80%] py-3 flex items-center justify-center gap-2 transition-all duration-300 ${saved ? 'bg-green-500 hover:bg-green-500' : !isModified ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                'Saving...'
              ) : saved ? (
                <><span style={{ animation: 'bounceOnce 0.5s ease' }}>✓</span> Saved!</>
              ) : !isModified ? (
                <><Save className="w-5 h-5" /> No Changes</>
              ) : (
                <><Save className="w-5 h-5" /> Save Changes</>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all fields? This will reset every input in the form.')) {
                  const cleared = {};
                  Object.keys(form).forEach(k => { cleared[k] = ''; });
                  setForm(cleared);
                  setMissingFields([]);
                  setSaved(false);
                  setIsModified(false);
                }
              }}
              className="w-[20%] py-3 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all duration-300"
            >
              <X className="w-5 h-5" /> Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}