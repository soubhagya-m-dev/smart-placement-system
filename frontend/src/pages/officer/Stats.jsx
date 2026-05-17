import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => { if (data.success) setStats(data.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] || '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Placement Statistics</h1>
        {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="card text-center"><p className="text-3xl font-bold text-blue-600">{stats?.totalStudents || 0}</p><p className="text-gray-500">Total Students</p></div>
              <div className="card text-center"><p className="text-3xl font-bold text-green-600">{stats?.verifiedStudents || 0}</p><p className="text-gray-500">Verified</p></div>
              <div className="card text-center"><p className="text-3xl font-bold text-yellow-600">{stats?.activeJobs || 0}</p><p className="text-gray-500">Active Jobs</p></div>
              <div className="card text-center"><p className="text-3xl font-bold text-purple-600">{stats?.placed || 0}</p><p className="text-gray-500">Placed</p></div>
            </div>
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Export Reports</h2>
              <button onClick={() => exportCSV([{ students: stats?.totalStudents, verified: stats?.verifiedStudents, activeJobs: stats?.activeJobs, placed: stats?.placed }], 'stats-report.csv')} className="btn-primary flex items-center gap-2"><Download className="w-5 h-5" /> Export Statistics</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
