import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
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
    email: '',
    currentCGPA: '',
    numberOfBacklog: '',
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
    // Auto-uppercase for college ID (alphanumeric)
    if (field === 'collegeId') {
      value = value.toUpperCase();
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
    setForm({ ...form, [field]: value });
    setIsModified(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const hasBacklog = form.numberOfBacklog !== '' && parseInt(form.numberOfBacklog) > 0;
      await updateProfile({
        studentProfile: {
          ...user.studentProfile,
          ...form,
          tenthPercentage: form.tenthPercentage ? parseFloat(parseFloat(form.tenthPercentage).toFixed(2)) : undefined,
          twelfthPercentage: form.twelfthPercentage ? parseFloat(parseFloat(form.twelfthPercentage).toFixed(2)) : undefined,
          currentCGPA: hasBacklog ? 0 : (form.currentCGPA ? parseFloat(form.currentCGPA) : undefined),
          numberOfBacklog: form.numberOfBacklog !== '' ? parseInt(form.numberOfBacklog) : undefined,
          tenthPassingYear: form.tenthPassingYear ? parseInt(form.tenthPassingYear) : undefined,
          twelfthPassingYear: form.twelfthPassingYear ? parseInt(form.twelfthPassingYear) : undefined,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        }
      });
      toast.success('Profile updated!');
      setSaved(true);
      setIsModified(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) { toast.error('Failed to update'); }
    finally { setLoading(false); }
  };

  const hasBacklog = form.numberOfBacklog !== '' && parseInt(form.numberOfBacklog) > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <div className="card mb-6">
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">{user?.name?.[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.name}</h2>
              <p className="text-gray-500">{user?.email}</p>
              <span className="badge badge-blue mt-1">{user?.role}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">University Roll Number <span className="text-red-500">*</span></label>
                <input type="number" className="input" placeholder="Roll Number" value={form.universityRollNumber} onChange={e => handleChange('universityRollNumber', e.target.value)} minLength={11} maxLength={11} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">University Registration Number <span className="text-red-500">*</span></label>
                <input type="number" className="input" placeholder="Registration Number" value={form.universityRegistrationNumber} onChange={e => handleChange('universityRegistrationNumber', e.target.value)} minLength={12} maxLength={14} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">College ID <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="12 digit alphanumeric" value={form.collegeId} onChange={e => handleChange('collegeId', e.target.value)} maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admission Type <span className="text-red-500">*</span></label>
                <select className="input" value={form.admissionType} onChange={e => handleChange('admissionType', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Regular 4-year">Regular 4-year</option>
                  <option value="Lateral 3-year">Lateral 3-year</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Full Name (Block Letters) <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="Enter your full name" value={form.fullName} onChange={e => handleChange('fullName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stream <span className="text-red-500">*</span></label>
                <select className="input" value={form.stream} onChange={e => handleChange('stream', e.target.value)}>
                  <option value="">Select Stream</option>
                  <option value="CSE">CSE</option>
                  <option value="CSE(AI&ML)">CSE (AI & ML)</option>
                  <option value="AUE">AUE</option>
                  <option value="Civil">Civil</option>
                  <option value="ECE">ECE</option>
                  <option value="EE">EE</option>
                  <option value="ME">ME</option>
                  <option value="Robotics">Robotics</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Section <span className="text-red-500">*</span></label>
                <select className="input" value={form.section} onChange={e => handleChange('section', e.target.value)}>
                  <option value="">Select Section</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender <span className="text-red-500">*</span></label>
                <select className="input" value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth <span className="text-red-500">*</span></label>
                <input type="date" className="input" value={form.dateOfBirth} onChange={e => handleChange('dateOfBirth', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Number <span className="text-red-500">*</span></label>
                <input type="tel" className="input" placeholder="9876543210" value={form.contactNumber} onChange={e => handleChange('contactNumber', e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" className="input" placeholder="student@college.edu" value={form.email} onChange={e => handleChange('email', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 10th Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">10th Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board <span className="text-red-500">*</span></label>
                <select className="input" value={form.tenthBoard} onChange={e => handleChange('tenthBoard', e.target.value)}>
                  <option value="">Select Board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ICSE">ICSE</option>
                  <option value="State board">State board</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Medium <span className="text-red-500">*</span></label>
                <select className="input" value={form.tenthMedium} onChange={e => handleChange('tenthMedium', e.target.value)}>
                  <option value="">Select Medium</option>
                  <option value="bengali">Bengali</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Percentage<span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" max="100" className="input" placeholder="Percentage" value={form.tenthPercentage} onChange={e => handleChange('tenthPercentage', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Passing Year <span className="text-red-500">*</span></label>
                <input type="number" className="input" placeholder="YYYY" value={form.tenthPassingYear} onChange={e => handleChange('tenthPassingYear', e.target.value)} min={2000} max={2030} />
              </div>
            </div>
          </div>

          {/* 12th Details */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">12th Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Board <span className="text-red-500">*</span></label>
                <select className="input" value={form.twelfthBoard} onChange={e => handleChange('twelfthBoard', e.target.value)}>
                  <option value="">Select Board</option>
                  <option value="CBSE">CBSE</option>
                  <option value="ISC">ISC</option>
                  <option value="State board">State board</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Medium <span className="text-red-500">*</span></label>
                <select className="input" value={form.twelfthMedium} onChange={e => handleChange('twelfthMedium', e.target.value)}>
                  <option value="">Select Medium</option>
                  <option value="bengali">Bengali</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Percentage<span className="text-red-500">*</span></label>
                <input type="number" step="0.01" min="0" max="100" className="input" placeholder="Percentage" value={form.twelfthPercentage} onChange={e => handleChange('twelfthPercentage', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Passing Year <span className="text-red-500">*</span></label>
                <input type="number" className="input" placeholder="YYYY" value={form.twelfthPassingYear} onChange={e => handleChange('twelfthPassingYear', e.target.value)} min={2000} max={2030} />
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
                  {hasBacklog && <span className="text-xs text-gray-400 ml-1">(N/A — has backlog)</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={`input ${hasBacklog ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder={hasBacklog ? 'N/A' : '0.00'}
                  value={form.currentCGPA}
                  onChange={e => handleChange('currentCGPA', e.target.value)}
                  disabled={hasBacklog}
                  min={0}
                  max={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Backlog</label>
                <select className="input" value={form.numberOfBacklog} onChange={e => handleChange('numberOfBacklog', e.target.value)}>
                  <option value="">Select</option>
                  {[...Array(11)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium mb-1">Skills (comma-separated)</label>
                <input type="text" className="input" placeholder="Python, React, Java" value={form.skills} onChange={e => handleChange('skills', e.target.value)} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || saved || !isModified} className={`btn-primary w-full py-3 flex items-center justify-center gap-2 transition-all duration-300 ${saved ? 'bg-green-500 hover:bg-green-500' : !isModified ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
        </form>
      </div>
    </div>
  );
}