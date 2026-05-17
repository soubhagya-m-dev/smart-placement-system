import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Save, Upload } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    skills: user?.studentProfile?.skills?.join(', ') || '',
    tenthMarks: user?.studentProfile?.tenthMarks || '',
    twelfthMarks: user?.studentProfile?.twelfthMarks || '',
    currentCGPA: user?.studentProfile?.currentCGPA || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        name: form.name,
        phone: form.phone,
        studentProfile: {
          ...user.studentProfile,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
          tenthMarks: parseFloat(form.tenthMarks),
          twelfthMarks: parseFloat(form.twelfthMarks),
          currentCGPA: parseFloat(form.currentCGPA)
        }
      });
      toast.success('Profile updated!');
    } catch (error) { toast.error('Failed to update'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <div className="card mb-6">
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-2xl font-bold text-blue-600">{user?.name?.[0]}</span></div>
            <div><h2 className="text-xl font-semibold">{user?.name}</h2><p className="text-gray-500">{user?.email}</p><span className="badge badge-blue mt-1">{user?.role}</span></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div><label className="block text-sm font-medium mb-1">Full Name</label><input type="text" className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><label className="block text-sm font-medium mb-1">Skills (comma-separated)</label><input type="text" className="input" placeholder="JavaScript, React, Node.js" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium mb-1">10th %</label><input type="number" step="0.01" className="input" value={form.tenthMarks} onChange={e => setForm({...form, tenthMarks: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1">12th %</label><input type="number" step="0.01" className="input" value={form.twelfthMarks} onChange={e => setForm({...form, twelfthMarks: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1">CGPA</label><input type="number" step="0.01" className="input" value={form.currentCGPA} onChange={e => setForm({...form, currentCGPA: e.target.value})} /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{loading ? 'Saving...' : <><Save className="w-5 h-5" /> Save Changes</>}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
