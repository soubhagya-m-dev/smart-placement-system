import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Bell, CheckCircle, XCircle, Clock, ExternalLink, ChevronLeft } from 'lucide-react';

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, fetchNotifications } = useSocket();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    setLoading(false);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <Bell className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card h-24 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">No notifications yet</h3>
            <p className="text-gray-500 text-sm mt-1">You'll see updates about your applications here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div
                key={notif._id}
                onClick={() => !notif.read && markAsRead(notif._id)}
                className={`card border cursor-pointer transition-all hover:shadow-md ${
                  getBgColor(notif.type)
                } ${!notif.read ? 'ring-2 ring-blue-200' : 'opacity-75'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">{notif.message}</p>
                    {notif.link && (
                      <a
                        href={notif.link}
                        className="inline-flex items-center gap-1 text-blue-600 text-sm mt-2 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(notif.link);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" /> View details
                      </a>
                    )}
                    <p className="text-gray-400 text-xs mt-2">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}