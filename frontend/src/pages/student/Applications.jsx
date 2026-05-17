import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle, Briefcase } from 'lucide-react';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications/my', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setApplications(data.data.applications);
    } catch (error) { console.error('Failed to fetch'); }
    finally { setLoading(false); }
  };

  const filteredApps = applications.filter(app => filter === 'all' || app.status === filter);
  const statusIcon = (status) => {
    switch(status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'accepted': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'shortlisted': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };
  const statusColor = (status) => {
    switch(status) {
      case 'pending': return 'badge-yellow';
      case 'accepted': return 'badge-green';
      case 'rejected': return 'badge-red';
      case 'shortlisted': return 'badge-blue';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Applications</h1>
        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'shortlisted', 'accepted', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse"></div>)}</div>
        ) : filteredApps.length === 0 ? (
          <div className="card text-center py-16"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No applications yet</h3><Link to="/jobs" className="btn-primary mt-4">Browse Jobs</Link></div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map(app => (
              <div key={app._id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-blue-600" /></div>
                    <div>
                      <h3 className="font-semibold text-lg">{app.job?.title || 'Job Deleted'}</h3>
                      <p className="text-gray-500">{app.job?.companyName}</p>
                      <p className="text-sm text-gray-400">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {statusIcon(app.status)}
                    <span className={`badge ${statusColor(app.status)}`}>{app.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
