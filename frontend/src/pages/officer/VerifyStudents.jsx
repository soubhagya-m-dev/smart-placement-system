import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/officer/pending-verifications', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setStudents(data.data.students);
    } catch (error) { console.error('Failed'); }
    finally { setLoading(false); }
  };

  const verify = async (id) => {
    await fetch(`/api/students/${id}/verify`, { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    toast.success('Verified!'); fetchStudents();
  };

  const reject = async (id) => {
    const reason = prompt('Reason:'); if (!reason) return;
    await fetch(`/api/students/${id}/reject`, { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    toast.success('Rejected'); fetchStudents();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Verify Students</h1>
        {loading ? <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse"></div>)}</div> : students.length === 0 ? (
          <div className="card text-center py-12"><CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">All verified!</h3></div>
        ) : (
          <div className="space-y-4">{students.map(s => (
            <div key={s._id} className="card flex items-center justify-between">
              <div><h3 className="font-semibold">{s.name}</h3><p className="text-gray-500 text-sm">{s.email}</p></div>
              <div className="flex gap-2">
                <button onClick={() => verify(s._id)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Verify</button>
                <button onClick={() => reject(s._id)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
