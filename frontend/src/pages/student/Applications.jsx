import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle, Briefcase, ChevronDown, ChevronUp, Calendar, Star, Users, Bell } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedApp, setExpandedApp] = useState(null);
  const [timeline, setTimeline] = useState({});
  const [timelineLoading, setTimelineLoading] = useState(false);
  const { notifications } = useSocket();

  useEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/applications/my`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setApplications(data.data.applications);
    } catch (error) { console.error('Failed to fetch'); }
    finally { setLoading(false); }
  };

  const toggleExpand = async (app) => {
    if (expandedApp === app._id) {
      setExpandedApp(null);
      return;
    }
    setExpandedApp(app._id);
    if (!timeline[app._id]) {
      setTimelineLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/notifications?jobId=${app.job?._id || ''}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
          // Filter notifications for this application
          const appNotifications = data.data.notifications.filter(n =>
            n.job === app.job?._id || n.application === app._id
          );
          setTimeline(prev => ({ ...prev, [app._id]: appNotifications }));
        }
      } catch (error) { console.error('Failed to fetch timeline'); }
      finally { setTimelineLoading(false); }
    }
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

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'interview': return '📅';
      case 'exam': return '📝';
      case 'offer_letter': return '🏆';
      case 'rejection': return '❌';
      case 'status_update': return '🔄';
      case 'general': return '📢';
      default: return '🔔';
    }
  };

  const getTimelineColor = (type) => {
    switch(type) {
      case 'interview': return 'border-blue-500 bg-blue-50';
      case 'exam': return 'border-green-500 bg-green-50';
      case 'offer_letter': return 'border-yellow-500 bg-yellow-50';
      case 'rejection': return 'border-red-500 bg-red-50';
      case 'status_update': return 'border-purple-500 bg-purple-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Applications</h1>
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', 'pending', 'shortlisted', 'accepted', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg capitalize text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse"></div>)}</div>
        ) : filteredApps.length === 0 ? (
          <div className="card text-center py-16"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No applications yet</h3><Link to="/jobs" className="btn-primary mt-4">Browse Jobs</Link></div>
        ) : (
          <div className="space-y-4">
            {filteredApps.map(app => (
              <div key={app._id} className="card overflow-hidden">
                {/* Application Header */}
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
                  onClick={() => toggleExpand(app)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-blue-600" /></div>
                    <div>
                      <h3 className="font-semibold text-lg">{app.job?.title || 'Job Deleted'}</h3>
                      <p className="text-gray-500">{app.job?.companyName}</p>
                      <p className="text-sm text-gray-400">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusIcon(app.status)}
                    <span className={`badge ${statusColor(app.status)}`}>{app.status}</span>
                    {expandedApp === app._id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Timeline Section */}
                {expandedApp === app._id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Application Timeline
                    </h4>

                    {/* Applied event - always first */}
                    <div className="flex gap-3 mb-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <Star className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="w-0.5 h-full bg-gray-200"></div>
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium text-gray-800">Applied for job</p>
                        <p className="text-xs text-gray-500">{new Date(app.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-400 mt-1">{app.job?.companyName} - {app.job?.title}</p>
                      </div>
                    </div>

                    {timelineLoading ? (
                      <div className="text-center py-4 text-gray-500 text-sm">Loading timeline...</div>
                    ) : timeline[app._id]?.length > 0 ? (
                      <div className="relative">
                        {timeline[app._id]
                          .filter(n => n.eventDate)
                          .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
                          .map((notif, idx) => (
                            <div key={notif._id} className="flex gap-3 mb-2">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getTimelineColor(notif.type)} border-2`}>
                                  {getNotificationIcon(notif.type)}
                                </div>
                                {idx < timeline[app._id].filter(n => n.eventDate).length - 1 && (
                                  <div className="w-0.5 h-8 bg-gray-200"></div>
                                )}
                              </div>
                              <div className={`flex-1 rounded-lg p-3 mb-2 ${getTimelineColor(notif.type)}`}>
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm text-gray-800">{notif.title}</p>
                                  <span className="text-xs text-gray-500">{formatEventDate(notif.eventDate)}</span>
                                </div>
                                {notif.message && (
                                  <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                                )}
                                {/* Metadata details */}
                                {notif.metadata && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {notif.metadata.interviewDate && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">📅 {formatEventDate(notif.metadata.interviewDate)}</span>
                                    )}
                                    {notif.metadata.interviewTime && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">🕐 {notif.metadata.interviewTime}</span>
                                    )}
                                    {notif.metadata.interviewLocation && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">📍 {notif.metadata.interviewLocation}</span>
                                    )}
                                    {notif.metadata.examDate && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">📝 {formatEventDate(notif.metadata.examDate)}</span>
                                    )}
                                    {notif.metadata.examTime && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">🕐 {notif.metadata.examTime}</span>
                                    )}
                                    {notif.metadata.ctc && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">💰 {notif.metadata.ctc}</span>
                                    )}
                                    {notif.metadata.joiningDate && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">📆 Join: {formatEventDate(notif.metadata.joiningDate)}</span>
                                    )}
                                    {notif.metadata.newStatus && (
                                      <span className="text-xs bg-white/70 px-2 py-0.5 rounded">🔄 {notif.metadata.newStatus}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No timeline events yet. The TPO will send updates as your application progresses.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
